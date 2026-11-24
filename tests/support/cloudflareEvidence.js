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

export default attachCloudflareEvidence;
