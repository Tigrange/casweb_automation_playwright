// Storage-state capture. Generates ONE test per registered partner ×
// environment that logs in and persists the authenticated context to
// tests/support/storageState/<env>-<partner>.json.
//
// Functional tests then simply declare `test.use({ storageState })` instead
// of re-authenticating, keeping suites fast and stable.
//
// Note: requires accurate login selectors in LoginPage — verify once against
// the real site before relying on the generated storage state.

import { test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARTNERS } from '../../src/config/partners.js';
import { getRuntimeConfig } from '../../src/config/index.js';
import { getLoginPopup } from '../../src/factories/loginRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.resolve(__dirname, 'storageState');

const selected = process.env.PARTNER;
const entries = selected
  ? Object.entries(PARTNERS).filter(([id]) => id === selected)
  : Object.entries(PARTNERS);

for (const [partnerId, partner] of entries) {
  for (const envName of Object.keys(partner.envs)) {
    test(`authenticate ${partner.displayName} [${envName}]`, async ({ page }) => {
      const { baseURL, creds } = getRuntimeConfig(partnerId, envName);

      const login = getLoginPopup(page, partnerId);
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await login.open();
      await login.login(creds.username, creds.password);
      await login.expectLoggedIn();

      // Persist cookies/session for reuse by functional tests.
      await page
        .context()
        .storageState({ path: path.join(STORAGE_ROOT, `${envName}-${partner.id}.json`) });
    });
  }
}