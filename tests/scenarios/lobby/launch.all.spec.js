// LOBBY [03] â€” dynamic ALL-header-lobbys game-launch test.
//
// Instead of a hardcoded per-partner lobby list, this spec DISCOVERS the lobby
// pages from the site header at runtime, then for each lobby:
//   1. open the lobby page
//   2. detect the lobby design from the DOM
//   3. pick the FIRST available provider in the lobby filter
//   4. launch the FIRST game of that provider and apply the launch contract
//   5. continue with the next lobby page
//
// Any lobby that cannot be tested (unsupported design, no providers, failed
// launch) is collected as an incident and reported at the end â€” the run fails
// with the full list, exactly like the existing LOBBY [02] provider sweep.
//
// Header links differ per partner (Betfa has "games", TotoGaming "slots"; some
// hrefs are absolute on a playin subdomain, some relative; some carry a
// language prefix). Discovery resolves and dedupes them, and drops provider
// deep-links (e.g. /lobby/livecasino/providers/evolution) so each lobby page is
// tested once.
//
// Auth uses the tests/support/players/<env>-<partner>-<device>.json player
// (test AND prod). Missing player JSON fails loudly â€” no .env fallback.
//
// Phase 1: TotoGaming only (see SCALE TODO below). Devices: desktop + mobile.

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
  const legacy = page.locator('#js_lobby_main_wrapper');
  const widget = page.locator('#js_filter_button');

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
      expect(lobbys.length, 'no lobby links found in the header').toBeGreaterThan(0);

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

          // Providers are rendered asynchronously after the lobby opens; poll
          // until the filter chips/items are available before giving up.
          let providers = [];
          for (let attempt = 0; attempt < 10 && !providers.length; attempt += 1) {
            providers = (await lobby.listProviders()).filter(
              (p, i, all) => p.filter && all.findIndex((o) => o.filter === p.filter) === i,
            );
            if (!providers.length) await page.waitForTimeout(1_000);
          }
          if (!providers.length) {
            incidents.push({ lobby: lobbyUrl, error: 'no providers in the lobby filter' });
            continue;
          }

          // Try up to 3 filters; a filter can be empty for the player (e.g.
          // "favourites") or its first game can be broken/restricted (provider
          // error 999, account restriction Code -2). Every failed attempt keeps
          // its screenshot as evidence; the lobby only fails when NO filter can
          // launch a game.
          const candidateFilters = providers.slice(0, 3);
          const failedAttempts = [];
          let launched = false;
          for (const candidate of candidateFilters) {
            try {
              await lobby.selectProvider(candidate);
              await lobby.firstVisibleGameCard(3_000);
            } catch (err) {
              failedAttempts.push({
                filter: candidate.filter,
                error: `no visible games — ${String(err?.message || err).split('\n')[0]}`,
              });
              continue;
            }

            try {
              // No pinned game -> the FIRST game of the chosen filter.
              await lobby.launchGame(null, { verifyTimeout: 10_000 });
              launched = true;
              console.log(`[lobby] game launched @${at()} via filter: ${candidate.filter}`);
              break;
            } catch (err) {
              const shotName = `lobby-fail-${incidents.length + 1}-${candidate.filter}.png`;
              await testInfo
                .attach(shotName, {
                  body: await page.screenshot().catch(() => Buffer.alloc(0)),
                  contentType: 'image/png',
                })
                .catch(() => {});
              failedAttempts.push({
                filter: candidate.filter,
                screenshot: shotName,
                error: String(err?.message || err).split('\n')[0],
              });
              // A failed launch can leave the play page; reopen the lobby for
              // the next filter attempt.
              await closeGamePages(page);
              await lobby.open({ lobbyUrl }).catch(() => {});
            }
          }

          if (!launched) {
            incidents.push({
              lobby: lobbyUrl,
              error: `no filter could launch (${failedAttempts
                .map((f) => `${f.filter}: ${f.error}`)
                .join(' | ')})`,
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
