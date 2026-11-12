// Change-password flow tests.
//
//   CHANGE PASSWORD [01]  real change       -> reuses the authenticated storage
//                                               state captured by the auth setup
//                                               (never logs in) and changes the
//                                               player's password, then updates
//                                               the local player file so the
//                                               stored credentials stay in sync.
//   CHANGE PASSWORD [02]  mismatch UI       -> new != confirm; asserts the
//                                               validation error (no change made).
//
// The authenticated state is resolved per project device
// (project.metadata.authDevice) exactly like the login session check, so the
// same spec works in every browser project. Each run registers a FRESH player
// (auth setup), so mutating its password is safe.
//
// Tags are plain strings so playwright.config.js / the runner can select tests.
// Default is POSITIVE ONLY; pass TEST_TYPE=all (or --type=all) for @negative.

import { readFile, writeFile } from 'node:fs/promises';
import { test } from '#src/fixtures/base.js';
import { getChangePasswordPage } from '#src/factories/changePasswordRegistry.js';
import { getRuntimeConfig } from '#src/config/index.js';
import { requireStorageStatePath } from '#src/config/storageState.js';
import { playerPath } from '#src/config/players.js';

const { envName, partnerId, partner } = getRuntimeConfig();

/** The password the positive test changes the player to. */
const NEW_PASSWORD = 'Changepassword123?';

/** A second candidate, used on retries when the password was already changed. */
const ALT_PASSWORD = 'Changepassword124?';

/** Resolve the device from the active project's metadata. */
function deviceOf(testInfo) {
  return testInfo.project.metadata.authDevice ?? 'desktop';
}

/** Read the freshly registered player for the current env/partner/device. */
async function readPlayer(device) {
  return JSON.parse(await readFile(playerPath(envName, partnerId, device), 'utf8'));
}

/** Persist the player back to disk (keeps the local data file in sync). */
async function writePlayer(device, player) {
  await writeFile(playerPath(envName, partnerId, device), JSON.stringify(player, null, 2));
}

/** Pick a password that differs from the current one (retry-safe). */
function nextPassword(current) {
  return current === NEW_PASSWORD ? ALT_PASSWORD : NEW_PASSWORD;
}

// Both tests need the authenticated session produced by the auth setup.
test.use({
  storageState: async ({}, use, testInfo) => {
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
      const player = await readPlayer(device);
      const newPassword = nextPassword(player.password);

      const changePassword = getChangePasswordPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      await changePassword.open(player.username);
      await changePassword.changePassword(player.password, newPassword, newPassword);
      await changePassword.expectSuccessVisible();

      // Keep our local data file in sync with the player's real password.
      player.password = newPassword;
      await writePlayer(device, player);
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

      const changePassword = getChangePasswordPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      await changePassword.open(player.username);
      await changePassword.changePassword(player.password, NEW_PASSWORD, ALT_PASSWORD);
      await changePassword.expectMismatchErrorVisible();
    },
  );
});
