// Login flow blueprint. Demonstrates the full pattern:
//   - authenticated context via storageState (from setup.spec.js)
//   - a negative test (bad credentials -> error) authenticated fresh
//
// This is a reference test to validate the plumbing before scaling to
// casino / betting / inbox suites.

import { test, expect } from '../../src/fixtures/base.js';
import { getLoginPopup } from '../../src/factories/loginRegistry.js';
import { automationSelector } from '../../src/utils/automation.js';
import { getRuntimeConfig } from '../../src/config/index.js';
import { deviceLocator } from '../../src/utils/device.js';

// Valid login: reuse captured session from setup project.
// The storage-state file is keyed by environment (test|prod) and partner id.
const { envName, partnerId } = getRuntimeConfig();
const storageStateFile = `${process.cwd()}/tests/support/storageState/${envName}-${partnerId}.json`;

test.describe('LOGIN [01]: valid login (reused session)', () => {
  test.use({ storageState: storageStateFile });

  test('LOGIN [01]: opens the home page as authenticated user', async ({ runtime, page }) => {
    await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
    // Deposit button is only visible when the user is logged in.
    await expect(deviceLocator(page, {
      desktop: automationSelector('deposit_main_button'),
      mobile: '.tl_logged_in', // mobile deposit button selector
    })).toBeVisible();
    // Optional per-partner logged-in menu marker:
  });
});

// Fresh login with wrong credentials exposes the error state.
test.describe('LOGIN [02]: invalid login', () => {
  test('LOGIN [02]: rejects bad credentials and shows an error', async ({ runtime, page }) => {
    const login = getLoginPopup(page, runtime.partnerId);
    await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
    await login.open();
    await login.login('Wrong Username', 'definitely-wrong-password');
    await login.expectErrorVisible();
  });
});