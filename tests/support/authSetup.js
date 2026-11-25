// Shared REAL-LOGIN (authentication) setup, parameterised by device.
//
// This is the ONLY place a real username/password login is performed. For each
// registered partner x environment it:
//   1. reuses the hardcoded player captured in tests/support/players/ for this
//      environment/partner/device (registration is currently disabled)
//   2. opens the partner site (desktop or mobile template, by device)
//   3. opens the login popup via the partner-aware LoginPopup factory
//   4. logs in with the freshly registered player's credentials
//   5. verifies the login succeeded (form closed AND the logged-in marker)
//   6. persists the player to
//      tests/support/players/<env>-<partner>-<device>.json and the
//      authenticated storage state to
//      tests/support/storageState/<env>-<partner>-<device>.json
//
// The e2e projects consume the storage-state file and only verify the restored
// session; they never log in again (see tests/auth/login.spec.js).
//
// Registration is fail-hard: if the API call fails the setup test fails and
// Playwright skips every dependent e2e project (never a silent fallback).
//
// [DISABLED 2026-11-18 per tech-lead decision] No fresh player is registered per
// run via the B2B Registration API. Tests reuse the hardcoded players kept in
// tests/support/players/. The registration block below is commented out (not
// deleted) so it can be re-enabled in the future.
//
// Partner handling uses the existing registry (src/config/partners.js) and the
// existing LoginPopup factory (src/factories/loginRegistry.js), so no partner is
// hard-coded and partner-specific popups keep working.

import { test, expect } from '@playwright/test';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { PARTNERS } from '#src/config/partners.js';
import { getLoginPopup } from '#src/factories/loginRegistry.js';
import { storageStatePath } from '#src/config/storageState.js';
import { playerPath } from '#src/config/players.js';
// import { registerPlayer } from '#src/api/registerApi.js'; // registration disabled (see note above)
import { LOGGED_IN_MARKERS } from '#src/config/authMarkers.js';

/**
 * Register the real-login setup tests for one device.
 * @param {'desktop'|'mobile'} device
 */
export function defineAuthSetup(device) {
  const marker = LOGGED_IN_MARKERS[device];

  // Respect the runner's per-partner invocation; otherwise cover every partner.
  const selected = process.env.PARTNER;
  const entries = selected
    ? Object.entries(PARTNERS).filter(([id]) => id === selected)
    : Object.entries(PARTNERS);

  // Also scope to the SELECTED ENVIRONMENT (PLAYWRIGHT_ENV). A partner can have
  // both test+prod configured, but a run must only authenticate against the one
  // requested (prod auth uses a different registration API and would otherwise
  // run on --env=test too).
  const selectedEnv = process.env.PLAYWRIGHT_ENV;

  for (const [partnerId, partner] of entries) {
    const envNames =
      selectedEnv && partner.envs[selectedEnv]
        ? [selectedEnv]
        : Object.keys(partner.envs);

    for (const envName of envNames) {
      test(
        `LOGIN [00] REAL E2E login · ${partner.displayName} [${envName}] · ${device}`,
        async ({ page }) => {
          const baseURL = partner.envs[envName].baseURL;

          // [DISABLED 2026-11-18 per tech-lead decision] No fresh player per
          // run/device via the B2B Registration API. To re-enable, uncomment the
          // block below (it overwrites the stored player with a new one).
          //
          // const player = await registerPlayer({ partnerId: partner.id, envName, device });
          // await writeFile(
          //   playerPath(envName, partner.id, device),
          //   JSON.stringify(player, null, 2),
          // );

          // Reuse the hardcoded player kept in tests/support/players/. Fail loudly
          // if it is missing so dependent e2e projects skip rather than silently
          // run unauthenticated.
          const playerFile = playerPath(envName, partner.id, device);
          const player = JSON.parse(await readFile(playerFile, 'utf8'));

          // Remove any storage state from a PREVIOUS successful run BEFORE the
          // attempt: when this login fails, the stale session must not survive
          // (otherwise the session-check spec reuses an old file and "passes"
          // even though the current credentials are broken).
          const stateFile = storageStatePath(envName, partner.id, device);
          await rm(stateFile, { force: true }).catch(() => {});

          const login = getLoginPopup(page, partnerId);
          await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
          await login.open();
          await login.login(player.username, player.password);
          try {
            // Fails fast with the server message when the credentials are wrong
            // (or a CAPTCHA/lock is shown) instead of waiting for the form to
            // close until the test timeout.
            await login.expectLoginOutcome();
          } catch (err) {
            throw new Error(
              `[auth] ${err.message}\n` +
                `  player: ${player.username}\n` +
                `  file:   ${playerFile}\n` +
                `  partner: ${partnerId} [${envName}] · ${device}`,
            );
          }
          // Confirm the session is really authenticated before persisting it.
          await expect(page.locator(marker)).toBeVisible();

          // Persist the session. Firefox intermittently fails to restore the
          // state when it has to open a page for a THIRD-PARTY origin (e.g.
          // fin-*.com payment/tracking domains) — the saved session then fails
          // to load in other browsers. Those origins are not needed for the
          // authenticated session, so keep only the partner's own origin
          // (its baseURL host and subdomains) and leave ALL cookies untouched.
          const state = await page.context().storageState();
          const firstPartyHost = new URL(baseURL).hostname.replace(/^www\./, '');
          state.origins = state.origins.filter((origin) => {
            const host = new URL(origin.origin).hostname;
            return host === firstPartyHost || host.endsWith(`.${firstPartyHost}`);
          });
          await writeFile(
            storageStatePath(envName, partner.id, device),
            JSON.stringify(state, null, 2),
          );
        },
      );
    }
  }
}

export default defineAuthSetup;