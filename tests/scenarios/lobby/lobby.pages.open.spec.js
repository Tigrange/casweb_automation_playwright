// LOBBY [02] - header lobby pages OPEN (redirection check).
//
// Discovers the lobby pages from the site header at runtime and, for each one,
// verifies the page OPENED successfully - i.e. the lobby design component is
// rendered (legacy `#js_lobby_main_wrapper` OR widget `#js_filter_button`).
// NO game is launched here (that is LOBBY [03]); this case only proves the
// navigation/redirection lands on a working lobby page.
//
// Any lobby that does not render a lobby component (empty/marketing/error page)
// is collected as an incident and reported at the end with a screenshot.
//
// Auth uses the tests/support/players/<env>-<partner>-<device>.json player
// (test AND prod). A Cloudflare block SKIPS the partner (evidence attached).

import { test, expect } from '#src/fixtures/base.js';
import { resolveRuntimeConfig } from '#src/config/index.js';
import { storageStatePath } from '#src/config/storageState.js';
import { ensureEnvPlayerSession } from '#support/envPlayerAuth.js';
import { skipOnCloudflare } from '#support/cloudflareEvidence.js';
import { readPlayer, discoverLobbys, detectLobbyPage } from '#support/lobbyCommon.js';
import { attachTestRailCaseId } from '#support/testrail.js';

const { envName, partnerId, partner } = await resolveRuntimeConfig();

// TestRail case IDs for LOBBY [02] (separate web/mobile cases). Fill when
// the TestRail cases exist; null = nothing is attached.
const TESTRAIL_LOBBY_PAGES_OPEN = { web: null, mobile: null };

let sessionPromise;

test.use({
  // Log in with the player JSON credentials and persist the session BEFORE the
  // test context is created (same pattern as the other lobby specs).
  storageState: async ({ browser }, use, testInfo) => {
    const device = testInfo.project.metadata.authDevice ?? 'desktop';
    try {
      sessionPromise ??= (async () => {
        const player = await readPlayer(envName, partnerId, device);
        await ensureEnvPlayerSession({
          browser,
          partnerId,
          envName,
          device,
          username: player.username,
          password: player.password,
        });
      })();
      await sessionPromise;
    } catch (err) {
      await skipOnCloudflare(err, testInfo, { partnerId, envName });
    }
    await use(storageStatePath(envName, partnerId, device, 'envplayer'));
  },
});

test.describe('LOBBY [02]: header lobby pages open', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 });

  test(
    `LOBBY [02] header lobby pages open · ${partner.displayName}`,
    { tag: ['@positive', '@regression'] },
    async ({ runtime, page }, testInfo) => {
      attachTestRailCaseId(testInfo, TESTRAIL_LOBBY_PAGES_OPEN);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(45_000);

      const lobbys = await discoverLobbys(page);
      if (!lobbys.length) {
        console.warn(
          `[lobby] no lobby links found in the header for ${partnerId} [${envName}] — ` +
            `skipping LOBBY [02] for this partner`,
        );
        test.skip(true, 'no lobby links found in the header — LOBBY [02] skipped for this partner');
      }

      const incidents = [];
      for (const lobbyUrl of lobbys) {
        const startedAt = Date.now();
        console.log(`[lobby-open] START ${lobbyUrl}`);
        try {
          await page.goto(lobbyUrl, { waitUntil: 'domcontentloaded' });

          // Success = the lobby design component rendered.
          const lobby = await detectLobbyPage(page, 12_000);
          if (!lobby) {
            const shotName = `lobby-open-fail-${incidents.length + 1}.png`;
            await testInfo
              .attach(shotName, {
                body: await page.screenshot().catch(() => Buffer.alloc(0)),
                contentType: 'image/png',
              })
              .catch(() => {});
            incidents.push({
              lobby: lobbyUrl,
              screenshot: shotName,
              error: 'lobby page did not open (no lobby component rendered)',
            });
          } else {
            console.log(`[lobby-open] opened @${Math.round((Date.now() - startedAt) / 1000)}s`);
          }
        } catch (err) {
          incidents.push({ lobby: lobbyUrl, error: String(err?.message || err).split('\n')[0] });
        } finally {
          console.log(
            `[lobby-open] DONE ${lobbyUrl} (${Math.round((Date.now() - startedAt) / 1000)}s)`,
          );
        }
      }

      await testInfo.attach('lobby-pages-open-incidents.json', {
        body: JSON.stringify({ lobbys, incidents }, null, 2),
        contentType: 'application/json',
      });
      expect(
        incidents.map((i) => `${i.lobby}: ${i.error}`),
        `Lobby open incidents:\n${incidents.map((i) => `· ${i.lobby}: ${i.error}`).join('\n') || '(none)'}`,
      ).toEqual([]);
    },
  );
});
