// Registration flow tests (positive path only).
//
// The Step 1 -> Step 2 transition is gated by a Cloudflare Turnstile widget
// (`#TurnstileReg`, sitekey 0x4AAAAAAE590J1NThpXjXa2), invoked when "Continue"
// is clicked. In an automated browser Turnstile never issues a passing token,
// so the form stays on Step 1 and Step 2 is unreachable via UI automation.
// This suite fills Step 1 and confirms the continue button activates, then
// verifies the Turnstile gate appears — without attempting to bypass it.
//
// Tagged like the rest of the suite so the SAME filter that gates login also
// gates registration. Previously registration was only reachable through the
// dedicated package.json scripts; now TEST_TYPE (default positive) selects it
// for every project, and TEST_TAG=regression narrows to this suite.

import { test, expect } from '../../src/fixtures/base.js';
import { getRegisterPopup } from '../../src/factories/registerRegistry.js';
import { getRuntimeConfig } from '../../src/config/index.js';
import { buildRegisterData } from '../data/registerData.js';

const { partnerId } = getRuntimeConfig();
const VALID = buildRegisterData(partnerId);

/** Navigate home, open the register dialog for the active partner, return it. */
async function openRegister(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const register = getRegisterPopup(page, partnerId);
  await register.open();
  return register;
}


test(
  'REGISTER [01]: Only Step 1: continue activates with valid Step 1 data and is gated by Turnstile',
  { tag: ['@positive', '@regression'] },
  async ({ page }) => {
    const register = await openRegister(page);

    await register.fillStep1(VALID);

    // Step 1 is valid, so the primary button becomes clickable.
    await expect(register.submitButton).toBeEnabled();

    // Clicking "Continue" invokes the Captcha widget that gates the transition;
    // the form does not advance past Step 1 in automation.
    await register.continue();
    await expect(page.locator('#TurnstileReg')).toBeVisible();
  },
);


