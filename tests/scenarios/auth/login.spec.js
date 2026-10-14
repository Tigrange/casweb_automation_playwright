// Login flow tests.
//
//   LOGIN [00]  real E2E login      -> lives in tests/support/setup.*.spec.js
//                                      (auth-desktop / auth-mobile projects)
//   LOGIN [01]  session check       -> restores the saved storage state and
//                                      verifies the session; it NEVER logs in.
//   LOGIN [02]  invalid credentials -> fresh (logged-out) context, fake creds.
//
// The session check loads the state for the current project's device
// (project.metadata.authDevice): desktop browsers reuse <env>-<partner>-desktop,
// the mobile project reuses <env>-<partner>-mobile.
//
// Tags are plain strings so playwright.config.js / the runner can select tests.
// Default is POSITIVE ONLY; pass TEST_TYPE=all (or --type=all) for @negative.

import { test, expect } from '#src/fixtures/base.js';
import { getLoginPopup } from '#src/factories/loginRegistry.js';
import { getRuntimeConfig } from '#src/config/index.js';
import { storageStatePath } from '#src/config/storageState.js';
import { LOGGED_IN_MARKERS } from '#src/config/authMarkers.js';
import { deviceLocator } from '#src/utils/device.js';

const { envName, partnerId, partner } = getRuntimeConfig();

// Session check: reuse the authenticated state captured by the auth setup
// project for this project's device. Resolved at runtime from project metadata
// so the same spec works in every browser project without re-logging in.
test.describe('LOGIN [01]: session check (reused state)', () => {
  test.use({
    storageState: async ({}, use, testInfo) => {
      const device = testInfo.project.metadata.authDevice ?? 'desktop';
      await use(storageStatePath(envName, partnerId, device));
    },
  });

  test(
    `LOGIN [01] SESSION check (reused state) · ${partner.displayName}`,
    { tag: ['@positive', '@smoke', '@regression'] },
    async ({ runtime, page }) => {
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      // Device-aware logged-in marker: deposit button (desktop) / .tl_logged_in
      // (mobile). No login is performed here — only the restored session.
      await expect(deviceLocator(page, LOGGED_IN_MARKERS)).toBeVisible();
    },
  );
});

// Fresh login with wrong credentials exposes the error state.
test.describe('LOGIN [02]: invalid credentials UI', () => {
  test(
    `LOGIN [02] invalid credentials UI · ${partner.displayName}`,
    { tag: '@negative' },
    async ({ runtime, page }) => {
      const login = getLoginPopup(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      await login.open();
      await login.login('Wrong Username', 'definitely-wrong-password');
      // NOTE: the popup is known NOT to close after a failed login, so we assert
      // the error message directly and never wait for the popup to hide.
      await login.expectErrorVisible();
    },
  );
});