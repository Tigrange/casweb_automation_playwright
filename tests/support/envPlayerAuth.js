// Env-player login for the LOBBY build-time suite.
//
// While player verification is being clarified with the dev team, the lobby
// tests use an EXISTING (verified) account from .env instead of the fresh
// registration player. This helper performs a real UI login for the partner's
// <PARTNER>_<ENV>_USERNAME / _PASSWORD account and writes the standard storage
// state file reused by the specs.
//
// Cloudflare handling:
//   Â· Some partner sites sit behind Cloudflare and answer automated logins with
//     a challenge (403 / "Just a moment..." / "Performing security
//     verification"). Such a login throws a typed error with
//     `code = 'CLOUDFLARE_BLOCKED'` (plus screenshot + details) so specs can
//     report a clear incident instead of a confusing timeout.
//   Â· For partners with a rotating numeric domain (cozbet002.com ->
//     cozbet003.com ...) a Cloudflare block on one domain makes the login retry
//     on the NEXT numeric domain in the real browser before giving up.
//
// TODO: remove once the auth setup produces verified players.

import { writeFile } from 'node:fs/promises';
import { PARTNERS } from '#src/config/partners.js';
import { storageStatePath } from '#src/config/storageState.js';
import { resolveRuntimeConfig } from '#src/config/index.js';
import { domainCandidates } from '#src/utils/domain.js';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 393, height: 851 },
};

/** Marker used by specs to recognise and report a Cloudflare block. */
export const CLOUDFLARE_BLOCKED = 'CLOUDFLARE_BLOCKED';

/** Marker for a rotating-domain candidate that cannot be reached at all. */
export const DOMAIN_UNREACHABLE = 'DOMAIN_UNREACHABLE';

/**
 * Detect a Cloudflare challenge on the given page/response.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Response|null} response
 * @returns {Promise<boolean>}
 */
async function isCloudflareChallenge(page, response) {
  if (response && response.status() === 403) return true;
  if (/__cf_chl_|cdn-cgi\/challenge/i.test(page.url())) return true;
  const title = (await page.title().catch(() => '')).toLowerCase();
  if (/just a moment|attention required|performing security verification/.test(title)) return true;
  const body = await page
    .locator('body')
    .innerText({ timeout: 2_000 })
    .catch(() => '');
  return /cf-chl|ray id|performing security verification/i.test(body);
}

/**
 * Build the typed Cloudflare error (with screenshot evidence) on a page.
 * @param {import('@playwright/test').Page} page
 * @param {{ partnerId: string, envName: string, device: string, status?: number|null }} meta
 */
async function cloudflareError(page, { partnerId, envName, device, status = null }) {
  const url = page.url();
  const err = new Error(
    `Cloudflare blocked login for ${partnerId} [${envName}] (${status ?? 'challenge'} on ${url}) â€” ` +
      `the site requires Cloudflare clearance/allowlisting for automation`,
  );
  err.code = CLOUDFLARE_BLOCKED;
  err.details = { partnerId, envName, device, url, status };
  err.screenshot = await page.screenshot({ fullPage: false }).catch(() => null);
  return err;
}

/**
 * Log in with the partner's env account and persist its storage state.
 *
 * Credentials come from `username`/`password` when provided (e.g. read from a
 * tests/support/players/<env>-<partner>-<device>.json file); otherwise they are
 * resolved from the partner's .env account as before.
 *
 * @param {{ browser: import('@playwright/test').Browser, partnerId: string, envName: string, device?: 'desktop'|'mobile', username?: string, password?: string }} params
 */
export async function ensureEnvPlayerSession({
  browser,
  partnerId,
  envName,
  device = 'desktop',
  username: explicitUsername,
  password: explicitPassword,
}) {
  const partnerEnv = PARTNERS[partnerId]?.envs?.[envName];
  if (!partnerEnv?.baseURL) {
    throw new Error(`No baseURL for partner "${partnerId}" env "${envName}"`);
  }

  // Explicit credentials (player JSON) win; otherwise use the .env account.
  const prefix = partnerEnv.credsEnvPrefix || partnerId.toUpperCase();
  const env = envName.toUpperCase();
  const username = explicitUsername || process.env[`${prefix}_${env}_USERNAME`];
  const password = explicitPassword || process.env[`${prefix}_${env}_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Missing player credentials for ${partnerId} [${envName}] ${device}. ` +
        `Provide them via the player JSON or ${prefix}_${env}_USERNAME / ${prefix}_${env}_PASSWORD.`,
    );
  }

  // The configured baseURL is only the starting point: resolveRuntimeConfig()
  // picks the HTTP-live domain, then domainCandidates() lets us rotate further
  // if Cloudflare blocks the login on that domain (numeric-domain partners).
  const resolved = await resolveRuntimeConfig(partnerId, envName, device);
  const candidates = domainCandidates(resolved.baseURL);

  const blockedDomains = [];
  const attemptsLog = [];
  let lastCloudflareError = null;
  let lastError = null;

  for (const baseURL of candidates) {
    try {
      return await loginOnDomain({ browser, partnerId, envName, device, username, password, baseURL });
    } catch (err) {
      const host = new URL(baseURL).hostname;
      if (err?.code === CLOUDFLARE_BLOCKED) blockedDomains.push(host);
      else if (err?.code === DOMAIN_UNREACHABLE) attemptsLog.push(`${host} (unreachable)`);
      else throw err;

      lastError = err;
      if (err?.code === CLOUDFLARE_BLOCKED) lastCloudflareError = err;
      if (candidates.length > 1) {
        console.log(`[envPlayerAuth] ${host}: ${err.code} â†’ trying next domain`);
      }
    }
  }

  // Every candidate failed. Prefer a Cloudflare-labelled incident when any
  // candidate was blocked by Cloudflare; otherwise surface the last error.
  const summary = `attempted: ${candidates.map((u) => new URL(u).hostname).join(', ')}`;
  const incident = lastCloudflareError || lastError;
  incident.details = {
    ...(incident.details || {}),
    partnerId,
    envName,
    device,
    attemptedDomains: candidates.map((u) => new URL(u).hostname),
    unreachable: attemptsLog,
  };
  incident.message =
    `Login blocked for ${partnerId} [${envName}] ${device} â€” ${summary}. ` +
    (lastCloudflareError
      ? `Cloudflare challenge detected (${blockedDomains.join(', ')}); the site requires Cloudflare clearance/allowlisting for automation.`
      : `No reachable domain/server responded.`);
  throw incident;
}

/**
 * Perform the real login flow against ONE base URL.
 * Throws `CLOUDFLARE_BLOCKED` when the site answers with a CF challenge.
 */
async function loginOnDomain({ browser, partnerId, envName, device, username, password, baseURL }) {
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
    let lastStatus = null;
    for (let attempt = 1; attempt <= 4 && !hasLoginForm; attempt += 1) {
      await context.clearCookies().catch(() => {});
      const loginResponse = await page
        .goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        .catch(() => null);
      lastStatus = loginResponse?.status() ?? null;
      // The login form can be a lazily-rendered dialog (Betfa TST redirects to
      // /?logDialog=1 and mounts the form asynchronously), so poll for it
      // instead of trusting a single short wait.
      hasLoginForm = await page
        .locator('#password, [automation="password_input"]')
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (!hasLoginForm && (await isCloudflareChallenge(page, loginResponse))) {
        // A Cloudflare challenge does not clear by retrying the same URL, so
        // fail fast for THIS domain (the caller then tries the next numeric
        // domain, and eventually skips the partner).
        throw await cloudflareError(page, { partnerId, envName, device, status: lastStatus });
      }
      if (!hasLoginForm && /^(chrome-error:|about:blank)/.test(page.url())) {
        // Unreachable domain — retrying cannot help; let the caller rotate to
        // the next numeric domain (or report the incident) immediately.
        const err = new Error(
          `Domain unreachable for ${partnerId} [${envName}] ${device}: ${baseURL}`,
        );
        err.code = DOMAIN_UNREACHABLE;
        err.details = { partnerId, envName, device, baseURL };
        throw err;
      }
      console.log(
        `[envPlayerAuth] login page attempt ${attempt} status=${lastStatus} ` +
          `url=${page.url()} form=${hasLoginForm}`,
      );
    }
    if (!hasLoginForm) {
      // All attempts challenged by Cloudflare â†’ report it as such.
      if (await isCloudflareChallenge(page, null)) {
        throw await cloudflareError(page, { partnerId, envName, device, status: lastStatus });
      }
      // A rotating-domain candidate can simply be dead (DNS gone / connection
      // refused) â€” mark it so the caller can try the next numeric domain.
      if (/^(chrome-error:|about:blank)/.test(page.url())) {
        const err = new Error(`Domain unreachable for ${partnerId} [${envName}] ${device}: ${baseURL}`);
        err.code = DOMAIN_UNREACHABLE;
        err.details = { partnerId, envName, device, baseURL };
        throw err;
      }
      throw new Error(
        `Login form not found for ${partnerId} [${envName}] â€” last page was ${page.url()}`,
      );
    }

    await page.locator('#email, [automation="email_input"]').first().fill(username);
    await page.locator('#password, [automation="password_input"]').first().fill(password);

    // Programmatic submit (no user gesture needed) â€” avoids overlay/pointer
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
      // The login POST itself can be intercepted by Cloudflare (seen on Betfa:
      // "Just a moment..." after submit) â€” report that as a CF block too.
      if (await isCloudflareChallenge(page, null)) {
        throw await cloudflareError(page, { partnerId, envName, device, status: null });
      }
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
