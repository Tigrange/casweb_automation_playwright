// LOBBY [03] - dynamic ALL-header-lobbys game-launch test.
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
import { readFile } from 'node:fs/promises';
import { test, expect } from '#src/fixtures/base.js';
import { resolveRuntimeConfig } from '#src/config/index.js';
import { storageStatePath } from '#src/config/storageState.js';
import { playerPath } from '#src/config/players.js';
import { LobbyGamesLaunchOldPage } from '#src/pages/lobby/LobbyGamesLaunchOldPage.js';
import { LobbyGamesLaunchNewPage } from '#src/pages/lobby/LobbyGamesLaunchNewPage.js';
import { ensureEnvPlayerSession } from '#support/envPlayerAuth.js';
import { attachCloudflareEvidence } from '#support/cloudflareEvidence.js';

const { envName, partnerId, partner } = await resolveRuntimeConfig();

let sessionPromise;

/**
 * Read the player JSON for this env/partner/device. Fails loudly when missing.
 * @param {'desktop'|'mobile'} device
 */
async function readPlayer(device) {
  const file = playerPath(envName, partnerId, device);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new Error(
      `Missing player file for ${partnerId} [${envName}] ${device}: ${file}. ` +
        `Create it from a valid account (tests/support/players) and re-run.`,
    );
  }
}

test.use({
  // Log in with the player JSON credentials and persist the session BEFORE the
  // test context is created (same pattern as the other lobby specs).
  storageState: async ({ browser }, use, testInfo) => {
    const device = testInfo.project.metadata.authDevice ?? 'desktop';
    try {
      sessionPromise ??= (async () => {
        const player = await readPlayer(device);
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
      await attachCloudflareEvidence(err, testInfo);
      throw err;
    }
    await use(storageStatePath(envName, partnerId, device, 'envplayer'));
  },
});

/**
 * Collect the lobby page URLs from the header nav.
 *
 * Stable hook: header menu links (`a.js_menu_links`) whose href contains
 * `/lobby/`. Absolute and relative hrefs are both resolved; duplicates are
 * removed; provider deep-links (extra path segments after the lobby type) are
 * excluded.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} absolute lobby URLs
 */
async function discoverLobbys(page) {
  const hrefs = await page
    .locator('a.js_menu_links[href*="/lobby/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')).filter(Boolean));

  const urls = [];
  const seen = new Set();
  for (const href of hrefs) {
    let resolved;
    try {
      resolved = new URL(href, page.url());
    } catch {
      continue;
    }
    // Lobby type page only: `/lobby/<type>` or `/lobby/<type>/main`
    // (a language prefix like `/en` or `/hy` is fine before `/lobby/`).
    if (!/\/lobby\/[^/]+(?:\/main)?\/?$/i.test(resolved.pathname)) continue;
    const key = resolved.href.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(resolved.href);
  }
  return urls;
}

/**
 * Detect the lobby design from the DOM and return the matching page object.
 * Returns `null` when the page is neither the legacy nor the widget lobby.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<LobbyGamesLaunchOldPage|LobbyGamesLaunchNewPage|null>}
 */
async function detectLobbyPage(page) {
  const legacy = page.locator('#js_lobby_main_wrapper'); //detects the legacy lobby wrapper (desktop + mobile)
  const widget = page.locator('#js_filter_button'); //detects the widget lobby filter button (desktop + mobile)

  const outcome = await Promise.race([
    legacy
      .waitFor({ state: 'visible', timeout: 12_000 })
      .then(() => 'legacy')
      .catch(() => null),
    widget
      .waitFor({ state: 'visible', timeout: 12_000 })
      .then(() => 'widget')
      .catch(() => null),
  ]);

  if (outcome === 'legacy') return new LobbyGamesLaunchOldPage(page);
  if (outcome === 'widget') return new LobbyGamesLaunchNewPage(page);
  return null;
}

/** Close any popup/tab opened by a game launch (best effort, time-bounded). */
async function closeGamePages(page) {
  const extras = page.context().pages().filter((p) => p !== page && !p.isClosed());
  if (!extras.length) return;
  // Closing a live game tab can take minutes (busy page / pending unload), so
  // never block the loop on it: race the closes against a short deadline.
  const closing = Promise.all(extras.map((p) => p.close().catch(() => {})));
  await Promise.race([closing, page.waitForTimeout(5_000)]).catch(() => {});
}

test.describe('LOBBY [03]: all header lobbys', () => {
  // The loop opens every discovered lobby and launches a game in each, so give
  // the whole test plenty of headroom (many lobbys x provider filter + launch).
  test.describe.configure({ mode: 'serial', timeout: 900_000 });

  test(
    `LOBBY [03] all header lobbys · ${partner.displayName}`,
    { tag: ['@positive', '@regression'] },
    async ({ runtime, page }, testInfo) => {
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
