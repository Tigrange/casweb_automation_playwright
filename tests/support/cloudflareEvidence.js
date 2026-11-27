// Attach Cloudflare-block evidence to a Playwright test result.
//
// The login helper (tests/support/envPlayerAuth.js) throws a typed error with
// `code === 'CLOUDFLARE_BLOCKED'`, carrying a screenshot buffer and details.
// Specs call this in their storageState fixture catch block before re-throwing,
// so the HTML report shows a clearly labelled incident with evidence while the
// run keeps going with the other partners.

/**
 * @param {any} err error thrown by ensureEnvPlayerSession
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export async function attachCloudflareEvidence(err, testInfo) {
  if (err?.code !== 'CLOUDFLARE_BLOCKED') return;

  if (err.screenshot) {
    await testInfo
      .attach('cloudflare-blocked.png', { body: err.screenshot, contentType: 'image/png' })
      .catch(() => {});
  }
  await testInfo
    .attach('cloudflare-blocked.json', {
      body: JSON.stringify(err.details ?? { message: err.message }, null, 2),
      contentType: 'application/json',
    })
    .catch(() => {});
}

/**
 * Handle a login error: attach Cloudflare evidence when applicable and SKIP the
 * test (Cloudflare cannot be switched off on the partner side, so a blocked
 * partner is skipped — with the evidence in the report — and the run continues
 * with the other partners). Non-Cloudflare errors are re-thrown unchanged.
 *
 * @param {any} err
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{ partnerId: string, envName: string }} meta
 */
export async function skipOnCloudflare(err, testInfo, { partnerId, envName }) {
  if (err?.code !== 'CLOUDFLARE_BLOCKED') throw err;

  await attachCloudflareEvidence(err, testInfo);
  const reason =
    `Cloudflare blocked ${partnerId} [${envName}] — skipped ` +
    `(partner site requires allowlisting; evidence attached)`;
  console.warn(`[cloudflare] ${reason}`);
  testInfo.skip(true, reason);
}

/**
 * True when the page is a Cloudflare challenge / security-verification page.
 * Used to fail fast with a clear message instead of waiting for the test
 * timeout (the login form / lobby content never appears behind the challenge).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isCloudflarePage(page) {
  if (/__cf_chl_|cdn-cgi\/challenge/i.test(page.url())) return true;
  const title = (await page.title().catch(() => '')).toLowerCase();
  if (/just a moment|attention required|performing security verification/.test(title)) return true;
  const body = await page
    .locator('body')
    .innerText({ timeout: 2_000 })
    .catch(() => '');
  return /performing security verification|cf-chl|ray id/i.test(body);
}

/**
 * Wait until the page becomes a Cloudflare challenge (or the timeout passes).
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @returns {Promise<boolean>}
 */
export async function waitForCloudflare(page, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await isCloudflarePage(page)) return true;
    await page.waitForTimeout(500).catch(() => {});
  }
  return false;
}

/**
 * Build a labeled Cloudflare error (with a screenshot) for non-lobby flows,
 * where a blocked partner is a FAILED result with a clear reason.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ partnerId: string, envName: string, device?: string }} meta
 */
export async function cloudflareBlockedError(page, { partnerId, envName, device = 'desktop' }) {
  const err = new Error(
    `Cloudflare blocked ${partnerId} [${envName}] ${device} on ${page.url()} — ` +
      `the site requires Cloudflare clearance/allowlisting for automation`,
  );
  err.code = 'CLOUDFLARE_BLOCKED';
  err.details = { partnerId, envName, device, url: page.url() };
  err.screenshot = await page.screenshot({ fullPage: false }).catch(() => null);
  return err;
}

export default attachCloudflareEvidence;
