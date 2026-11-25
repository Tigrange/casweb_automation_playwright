// LOBBY [03] - header lobby pages: launch the FIRST game of each lobby.
// (LOBBY [02] in lobby.pages.open.spec.js only checks that the pages open.)
//
// Instead of a hardcoded per-partner lobby list, this spec DISCOVERS the lobby
// pages from the site header at runtime, then for each lobby:
//   1. open the lobby page
//   2. detect the lobby design from the DOM
//   3. launch the FIRST game available in the lobby's default grid
//      (NO provider/category filter is applied in this scenario)
//   4. continue with the next lobby page
//
// Any lobby that cannot be tested (unsupported design, no games, failed launch)
// is collected as an incident and reported at the end - the run fails with the
// full list. Failed launches keep a screenshot attached as evidence.
//
// Header links differ per partner (Betfa has "games", TotoGaming "slots"; some
// hrefs are absolute on a playin subdomain, some relative; some carry a
// language prefix). Discovery resolves and dedupes them, and drops provider
// deep-links (e.g. /lobby/livecasino/providers/evolution) so each lobby page is
// tested once.
//
// Auth uses the tests/support/players/<env>-<partner>-<device>.json player
// (test AND prod). Missing player JSON fails loudly - no .env fallback.
// A Cloudflare block is reported as a labelled incident with evidence (see
// tests/support/cloudflareEvidence.js).
import { test, expect } from '#src/fixtures/base.js';
import { resolveRuntimeConfig } from '#src/config/index.js';
import { storageStatePath } from '#src/config/storageState.js';
import { ensureEnvPlayerSession } from '#support/envPlayerAuth.js';
import { skipOnCloudflare } from '#support/cloudflareEvidence.js';
import { readPlayer, discoverLobbys, detectLobbyPage, closeGamePages } from '#support/lobbyCommon.js';
import { attachTestRailCaseId } from '#support/testrail.js';

const { envName, partnerId, partner } = await resolveRuntimeConfig();

// TestRail case IDs for LOBBY [03] (separate web/mobile cases). Fill when
// the TestRail cases exist; null = nothing is attached.
const TESTRAIL_LOBBY_FIRST_GAME = { web: null, mobile: null };

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

test.describe('LOBBY [03]: header lobby pages first game launch', () => {
  // The loop opens every discovered lobby and launches a game in each, so give
  // the whole test plenty of headroom (many lobbys x provider filter + launch).
  test.describe.configure({ mode: 'serial', timeout: 900_000 });

  test(
    `LOBBY [03] header lobby pages first game · ${partner.displayName}`,
    { tag: ['@positive', '@regression'] },
    async ({ runtime, page }, testInfo) => {
      attachTestRailCaseId(testInfo, TESTRAIL_LOBBY_FIRST_GAME);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      // Guard against pathological waits so a single bad lobby cannot eat the
      // whole test budget (each game launch is verified with a short timeout).
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(45_000);

      const lobbys = await discoverLobbys(page);

      // No lobby links in the header = nothing to test for this partner. Log it
      // clearly, mark the test as skipped (visible in the report) and let the
      // runner continue with the next partner.
      if (!lobbys.length) {
        console.warn(
          `[lobby] no lobby links found in the header for ${partnerId} [${envName}] — ` +
            `skipping LOBBY [03] for this partner`,
        );
        test.skip(true, 'no lobby links found in the header — LOBBY [03] skipped for this partner');
      }

      const incidents = [];
      for (const lobbyUrl of lobbys) {
        const startedAt = Date.now();
        const at = () => `${Math.round((Date.now() - startedAt) / 1000)}s`;
        console.log(`[lobby] START ${lobbyUrl}`);
        try {
          await page.goto(lobbyUrl, { waitUntil: 'domcontentloaded' });

          const lobby = await detectLobbyPage(page);
          if (!lobby) {
            incidents.push({ lobby: lobbyUrl, error: 'unsupported/empty lobby design' });
            continue;
          }

          // Fresh open through the page object (it also waits for its grid).
          await lobby.open({ lobbyUrl });

          // NO filter is applied in this scenario: just launch the first game
          // available in the lobby's default grid, then move on to the next
          // lobby. The grid loads asynchronously after the lobby opens, so poll
          // until at least one game card is visible.
          let hasGames = false;
          for (let attempt = 0; attempt < 10 && !hasGames; attempt += 1) {
            hasGames = await lobby
              .firstVisibleGameCard(1_000)
              .then(() => true)
              .catch(() => false);
          }
          if (!hasGames) {
            incidents.push({ lobby: lobbyUrl, error: 'no games visible in lobby' });
            continue;
          }

          try {
            // No pinned game -> the FIRST game of the default lobby grid.
            await lobby.launchGame(null, { verifyTimeout: 10_000 });
            console.log(`[lobby] game launched @${at()}`);
          } catch (err) {
            const shotName = `lobby-fail-${incidents.length + 1}.png`;
            await testInfo
              .attach(shotName, {
                body: await page.screenshot().catch(() => Buffer.alloc(0)),
                contentType: 'image/png',
              })
              .catch(() => {});
            incidents.push({
              lobby: lobbyUrl,
              screenshot: shotName,
              error: String(err?.message || err).split('\n')[0],
            });
          }
        } catch (err) {
          incidents.push({ lobby: lobbyUrl, error: String(err?.message || err).split('\n')[0] });
        } finally {
          await closeGamePages(page);
          console.log(`[lobby] DONE ${lobbyUrl} (${Math.round((Date.now() - startedAt) / 1000)}s)`);
        }
      }

      await testInfo.attach('lobby-all-incidents.json', {
        body: JSON.stringify({ lobbys, incidents }, null, 2),
        contentType: 'application/json',
      });
      expect(
        incidents.map((i) => `${i.lobby}${i.provider ? ` [${i.provider}]` : ''}: ${i.error}`),
        `Lobby incidents:\n${incidents.map((i) => `· ${i.lobby}${i.provider ? ` [${i.provider}]` : ''}: ${i.error}`).join('\n') || '(none)'}`,
      ).toEqual([]);
    },
  );
});
