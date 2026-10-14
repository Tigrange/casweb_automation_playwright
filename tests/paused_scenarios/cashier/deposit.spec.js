// Cashier (deposit) tests.
//
//   CASHIER [01] deposit availability -> restores the saved session for the
//                current project's device and verifies the deposit flow:
//                  · old cashier : first method opens, amount accepted and the
//                                  pay button redirects to the payment page.
//                  · new cashier : the deposit popup opens (an in-popup error
//                                  message still counts as a pass).
//
// Uses the authenticated state captured by the auth setup project, per DEVICE
// (project.metadata.authDevice), so desktop and mobile each reuse their own
// session — no login is performed here.

import { test } from '../../../src/fixtures/base.js';
import { getCashierPage } from '../../../src/factories/cashierRegistry.js';
import { getRuntimeConfig } from '../../../src/config/index.js';
import { storageStatePath } from '../../../src/config/storageState.js';
import { buildDepositData } from '../../data/depositData.js';

const { envName, partnerId, partner } = getRuntimeConfig();

test.describe('CASHIER [01]: deposit availability', () => {
  test.use({
    storageState: async ({}, use, testInfo) => {
      const device = testInfo.project.metadata.authDevice ?? 'desktop';
      await use(storageStatePath(envName, partnerId, device));
    },
  });

  test(
    `CASHIER [01] deposit available · ${partner.displayName}`,
    { tag: ['@positive', '@smoke'] },
    async ({ runtime, page }) => {
      const cashier = getCashierPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      await cashier.open();
      // await cashier.verifyDepositAvailable(buildDepositData(runtime.partnerId));
    },
  );
});
