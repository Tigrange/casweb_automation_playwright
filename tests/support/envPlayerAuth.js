// Env-player login for the LOBBY build-time suite.
//
// While player verification is being clarified with the dev team, the lobby
// tests use an EXISTING (verified) account from .env instead of the fresh
// registration player. This helper performs a real UI login for the partner's
// <PARTNER>_<ENV>_USERNAME / _PASSWORD account and writes the standard storage
// state file reused by the specs.
//
// TODO: remove once the auth setup produces verified players.

import { writeFile } from 'node:fs/promises';
import { PARTNERS } from '#src/config/partners.js';
import { storageStatePath } from '#src/config/storageState.js';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 393, height: 851 },
};

/**
 * Log in with the partner's env account and persist its storage state.
 *
 * @param {{ browser: import('@playwright/test').Browser, partnerId: string, envName: string, device?: 'desktop'|'mobile' }} params
 */
export async function ensureEnvPlayerSession({ browser, partnerId, envName, device = 'desktop' }) {
  const partnerEnv = PARTNERS[partnerId]?.envs?.[envName];
  const baseURL = partnerEnv?.baseURL;
  if (!baseURL) {
    throw new Error(`No baseURL for partner "${partnerId}" env "${envName}"`);
  }

  // Use the partner's configured credential prefix so prod accounts resolve
  // correctly, e.g. TOTOGAMING_PROD_*, COZBET_SHARED_PROD_*, TOTOGAMINGRO_PROD_*.
  const prefix = partnerEnv.credsEnvPrefix || partnerId.toUpperCase();
  const env = envName.toUpperCase();
  const username = process.env[`${prefix}_${env}_USERNAME`];
  const password = process.env[`${prefix}_${env}_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Missing ${prefix}_${env}_USERNAME / ${prefix}_${env}_PASSWORD for the env-player login.`,
    );
  }

  const context = await browser.newContext({ viewport: VIEWPORTS[device] || VIEWPORTS.desktop });
  const page = await context.newPage();
  try {
    console.log(`[envPlayerAuth] logging in as "${username}" (${partnerId} [${envName}] ${device})`);
    // Keep the baseURL path prefix (e.g. /en) when resolving the login page.
    const loginBase = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
    const loginUrl = new URL('login/login', loginBase).href;

    // The login page intermittently redirects to a malformed URL (e.g.
    // /test.com?logDialog=1 or /smarticoClick();) and sometimes renders without
    // the form. Retry a few times until the form is present.
    let hasLoginForm = false;
    for (let attempt = 1; attempt <= 4 && !hasLoginForm; attempt += 1) {
      await context.clearCookies().catch(() => {});
      const loginResponse = await page
        .goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        .catch(() => null);
      await page.waitForTimeout(1_000);
      hasLoginForm =
        (await page
          .locator('#password, [automation="password_input"]')
          .count()
          .catch(() => 0)) > 0;
      console.log(
        `[envPlayerAuth] login page attempt ${attempt} status=${loginResponse?.status()} ` +
          `url=${page.url()} form=${hasLoginForm}`,
      );
    }
    if (!hasLoginForm) {
      throw new Error(
        `Login form not found for ${partnerId} [${envName}] — last page was ${page.url()}`,
      );
    }

    await page.locator('#email, [automation="email_input"]').first().fill(username);
    await page.locator('#password, [automation="password_input"]').first().fill(password);

    // Programmatic submit (no user gesture needed) — avoids overlay/pointer
    // interception on the login page and is fast.
    await page
      .locator('#staticLoginButton, [automation="login_button"]')
      .first()
      .evaluate((el) => el.click());

    // The site sometimes redirects to a malformed post-login URL; let the
    // navigation settle before a race that may be waiting on the same event.
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});

    // Logged in once a logout entry appears OR the login form disappears. The
    // site sometimes redirects to a malformed URL after login (still logged in),
    // so do not depend on the final URL.
    const loginOutcome = await Promise.race([
      page
        .locator('a[href*="logout"], a[href*="Logout"]')
        .first()
        .waitFor({ state: 'attached', timeout: 20_000 })
        .then(() => 'logout')
        .catch(() => null),
      page
        .locator('#staticLogin')
        .first()
        .waitFor({ state: 'hidden', timeout: 20_000 })
        .then(() => 'form-hidden')
        .catch(() => null),
    ]);
    if (!loginOutcome) {
      const validation = await page
        .locator('.field-validation-error, .errormassage, #loginError, #loginerrormessage')
        .allTextContents()
        .catch(() => []);
      throw new Error(
        `Env-player login failed for "${username}" on ${page.url()}` +
          (validation.length ? `: ${validation.join('; ')}` : ''),
      );
    }
    console.log(`[envPlayerAuth] login accepted (${loginOutcome})`);

    // Cookies are all the lobby tests need. `context.cookies()` is fast; the
    // full `storageState()` can take several seconds and races with teardown.
    const cookies = await context.cookies();
    await writeFile(
      storageStatePath(envName, partnerId, device, 'envplayer'),
      JSON.stringify({ cookies, origins: [] }, null, 2),
    );

    console.log(
      `[envPlayerAuth] logged in as "${username}" for ${partnerId} [${envName}] ${device} ` +
        `(${cookies.length} cookies)`,
    );
    return { username };
  } finally {
    // Best-effort teardown; never let it fail the beforeAll hook.
    await context.close().catch(() => {});
  }
}

export default ensureEnvPlayerSession;
