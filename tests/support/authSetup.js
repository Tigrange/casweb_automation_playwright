// Shared REAL-LOGIN (authentication) setup, parameterised by device.
//
// This is the ONLY place a real username/password login is performed. For each
// registered partner x environment it:
//   1. opens the partner site (desktop or mobile template, by device)
//   2. opens the login popup via the partner-aware LoginPopup factory
//   3. submits real credentials
//   4. verifies the login succeeded (form closed AND the logged-in marker)
//   5. saves the authenticated storage state to
//      tests/support/storageState/<env>-<partner>-<device>.json
//
// The e2e projects consume that file and only verify the restored session; they
// never log in again (see tests/auth/login.spec.js).
//
// Partner handling uses the existing registry (src/config/partners.js) and the
// existing LoginPopup factory (src/factories/loginRegistry.js), so no partner is
// hard-coded and partner-specific popups keep working.

import { test, expect } from '@playwright/test';
import { PARTNERS } from '../../src/config/partners.js';
import { getRuntimeConfig } from '../../src/config/index.js';
import { getLoginPopup } from '../../src/factories/loginRegistry.js';
import { automationSelector } from '../../src/utils/automation.js';
import { storageStatePath } from '../../src/config/storageState.js';

// Logged-in markers that already exist in the project — do not invent new ones.
const LOGGED_IN_MARKER = {
  desktop: automationSelector('deposit_main_button'),
  mobile: '.tl_logged_in',
};

/**
 * Register the real-login setup tests for one device.
 * @param {'desktop'|'mobile'} device
 */
export function defineAuthSetup(device) {
  const marker = LOGGED_IN_MARKER[device];

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
          const { baseURL, creds } = getRuntimeConfig(partnerId, envName);

          const login = getLoginPopup(page, partnerId);
          await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
          await login.open();
          await login.login(creds.username, creds.password);
          await login.expectLoggedIn();
          // Confirm the session is really authenticated before persisting it.
          await expect(page.locator(marker)).toBeVisible();

          await page
            .context()
            .storageState({ path: storageStatePath(envName, partner.id, device) });
        },
      );
    }
  }
}

export default defineAuthSetup;