// Change-password flow tests.
//
//   CHANGE PASSWORD [01]  real change       -> reuses the authenticated storage
//                                               state captured by the auth setup
//                                               (never logs in), changes the
//                                               player's password to a FRESH
//                                               unique value, then updates the
//                                               local player file(s) so the
//                                               stored credentials stay in sync.
//   CHANGE PASSWORD [02]  mismatch UI       -> new != confirm; asserts the
//                                               validation error (no change made).
//
// ============================================================================
// BEFORE RUNNING THESE TESTS IN PRODUCTION (checklist — agreed with QA):
//   1. Every DEVICE must have its OWN player account. Never share one account
//      between the desktop and mobile player JSONs.
//   2. The .env accounts must be DIFFERENT from the tests/support/players/*.json
//      accounts (the JSON players are the automation players).
//   3. Passwords are auto-generated per change (never reused). Do NOT reuse a
//      previously used password manually — the platform rejects it.
// ============================================================================
//
// Because players are now PERMANENT (no fresh registration per run), a password
// change must be mirrored into EVERY player file of this partner+env that uses
// the same username; otherwise a twin device file (or a shared account) keeps a
// stale password and the next login fails ("wrong password", and on some sites
// repeated wrong attempts trigger Cloudflare).
//
// The authenticated state is resolved per project device
// (project.metadata.authDevice) exactly like the login session check.
//
// Tags are plain strings so playwright.config.js / the runner can select tests.
// Default is POSITIVE ONLY; pass TEST_TYPE=all (or --type=all) for @negative.

import { readFile, writeFile } from 'node:fs/promises';
import { test } from '#src/fixtures/base.js';
import { getChangePasswordPage } from '#src/factories/changePasswordRegistry.js';
import { resolveRuntimeConfig } from '#src/config/index.js';
import { requireStorageStatePath } from '#src/config/storageState.js';
import { playerPath } from '#src/config/players.js';
import { attachTestRailCaseId } from '#support/testrail.js';

const { envName, partnerId, partner } = await resolveRuntimeConfig();

/**
 * A fresh, policy-compliant password that was never used before.
 * The platform refuses previously-used passwords, so a fixed toggle would fail
 * after one cycle. Timestamp keeps every change unique (upper/lower/digit/special,
 * ~18 chars).
 */
function nextPassword() {
  return `Changepass${Date.now().toString(36)}!9`;
}

/** Resolve the device from the active project's metadata. */
function deviceOf(testInfo) {
  return testInfo.project.metadata.authDevice ?? 'desktop';
}

/** Read the player for the current env/partner/device. */
async function readPlayer(device) {
  return JSON.parse(await readFile(playerPath(envName, partnerId, device), 'utf8'));
}

/** Persist the player back to disk (keeps the local data file in sync). */
async function writePlayer(device, player) {
  await writeFile(playerPath(envName, partnerId, device), JSON.stringify(player, null, 2));
}

/**
 * Mirror the new password into the OTHER device's player file when it uses the
 * same username (account shared across devices). Keeps every stored credential
 * file in sync so the next login never uses a stale password.
 */
async function syncSharedAccount(device, updatedPlayer) {
  const other = device === 'desktop' ? 'mobile' : 'desktop';
  try {
    const twin = await readPlayer(other);
    if (twin.username !== updatedPlayer.username) return; // separate accounts — nothing to do
    if (twin.password === updatedPlayer.password) return; // already in sync
    twin.password = updatedPlayer.password;
    await writePlayer(other, twin);
    console.log(
      `[change-password] synced the new password for "${updatedPlayer.username}" into the ` +
        `${other} player file (shared account)`,
    );
  } catch (err) {
    console.warn(`[change-password] could not sync the ${other} player file: ${err.message}`);
  }
}

// TestRail case IDs for the REAL password change (separate web/mobile cases).
const TESTRAIL_CHANGE_PASSWORD = { web: 'C27450', mobile: 'C27481' };

// Both tests need the authenticated session produced by the auth setup.
test.use({
  storageState: async ({}, use, testInfo) => {
    // Attach the case ID BEFORE setup so setup failures are reported too; only
    // the real-change case has a TestRail ID (mismatch UI case has none).
    if (!/mismatched/i.test(testInfo.title)) {
      attachTestRailCaseId(testInfo, TESTRAIL_CHANGE_PASSWORD);
    }
    const device = deviceOf(testInfo);
    await use(requireStorageStatePath(envName, partnerId, device));
  },
});

test.describe('CHANGE PASSWORD [01]: real change', () => {
  test(
    `CHANGE PASSWORD [01] real change · ${partner.displayName}`,
    { tag: ['@positive', '@smoke'] },
    async ({ runtime, page }, testInfo) => {
      const device = deviceOf(testInfo);
      // Re-read fresh: the twin project (or an earlier run) may have rotated it.
      const player = await readPlayer(device);
      const newPassword = nextPassword();

      const changePassword = getChangePasswordPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      await changePassword.open(player.username);
      await changePassword.changePassword(player.password, newPassword, newPassword);

      // Wait for an explicit outcome. CRITICAL: the new password must be
      // persisted unless the platform EXPLICITLY rejected the change —
      // otherwise a partner whose success markup we don't recognise would keep
      // the old password in the file while the account uses the new one (the
      // account is then unreachable for automation).
      const result = await changePassword.outcome();

      if (result.outcome === 'error') {
        throw new Error(
          `Password change was rejected by the site${result.detail ? `: ${result.detail}` : ''} — ` +
            `the player file still holds the old password`,
        );
      }

      // success OR unknown (success markup not matched on this partner):
      // persist the new password so the file can never go stale.
      player.password = newPassword;
      await writePlayer(device, player);
      await syncSharedAccount(device, player);

      if (result.outcome !== 'success') {
        throw new Error(
          'Could not confirm the password-change success message, but the new password was ' +
            'saved to the player file (the change most likely applied — verify manually once)',
        );
      }
    },
  );
});

test.describe('CHANGE PASSWORD [02]: mismatched passwords UI', () => {
  test(
    `CHANGE PASSWORD [02] mismatched passwords UI · ${partner.displayName}`,
    { tag: '@negative' },
    async ({ runtime, page }, testInfo) => {
      const device = deviceOf(testInfo);
      const player = await readPlayer(device);
      const newPassword = nextPassword();
      // Confirm with a different value -> mismatch validation error, no change.
      const confirmPassword = `${newPassword}different`;

      const changePassword = getChangePasswordPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      await changePassword.open(player.username);
      await changePassword.changePassword(player.password, newPassword, confirmPassword);
      await changePassword.expectMismatchErrorVisible();
    },
  );
});
