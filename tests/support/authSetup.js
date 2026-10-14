// Shared REAL-LOGIN (authentication) setup, parameterised by device.
//
// This is the ONLY place a real username/password login is performed. For each
// registered partner x environment it:
//   1. creates a FRESH player via the B2B Registration API (each run, each
//      device), so authenticated tests never depend on a shared .env account
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
// Partner handling uses the existing registry (src/config/partners.js) and the
// existing LoginPopup factory (src/factories/loginRegistry.js), so no partner is
// hard-coded and partner-specific popups keep working.

import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { PARTNERS } from '#src/config/partners.js';
import { getLoginPopup } from '#src/factories/loginRegistry.js';
import { storageStatePath } from '#src/config/storageState.js';
import { playerPath } from '#src/config/players.js';
import { registerPlayer } from '#src/api/registerApi.js';
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

  for (const [partnerId, partner] of entries) {
    for (const envName of Object.keys(partner.envs)) {
      test(
        `LOGIN [00] REAL E2E login · ${partner.displayName} [${envName}] · ${device}`,
        async ({ page }) => {
          const baseURL = partner.envs[envName].baseURL;

          // Fresh player per run/device, created through the B2B Registration
          // API. Throwing here fails the setup test, which in turn skips every
          // e2e project that depends on it.
          const player = await registerPlayer({ partnerId: partner.id, envName, device });
          await writeFile(
            playerPath(envName, partner.id, device),
            JSON.stringify(player, null, 2),
          );

          const login = getLoginPopup(page, partnerId);
          await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
          await login.open();
          await login.login(player.username, player.password);
          await login.expectLoggedIn();
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