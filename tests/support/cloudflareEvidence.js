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

export default attachCloudflareEvidence;
