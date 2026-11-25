// Shared helpers for the header-lobby specs (LOBBY [02] open check and
// LOBBY [03] first-game launch). Keeping them here means both cases discover
// and classify lobby pages exactly the same way.

import { readFile } from 'node:fs/promises';
import { playerPath } from '#src/config/players.js';
import { LobbyGamesLaunchOldPage } from '#src/pages/lobby/LobbyGamesLaunchOldPage.js';
import { LobbyGamesLaunchNewPage } from '#src/pages/lobby/LobbyGamesLaunchNewPage.js';

/**
 * Read the player JSON for this env/partner/device. Fails loudly when missing.
 * @param {string} envName
 * @param {string} partnerId
 * @param {'desktop'|'mobile'} device
 */
export async function readPlayer(envName, partnerId, device) {
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
export async function discoverLobbys(page) {
  // Desktop template: header nav links carry the stable `js_menu_links` class.
  let hrefs = await page
    .locator('a.js_menu_links[href*="/lobby/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')).filter(Boolean));

  // Mobile template: no `js_menu_links` — the lobby links live in the mobile
  // sidebar (`#menu-right` / `.cw_mob_sidebar`). Fall back to any lobby anchor.
  if (!hrefs.length) {
    hrefs = await page
      .locator('a[href*="/lobby/"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')).filter(Boolean));
  }

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

    // Dedupe language-prefixed duplicates ("/en/lobby/casino/main" ==
    // "/lobby/casino/main") and host variants of the same lobby page.
    const key = resolved.pathname.replace(/^\/([a-z]{2})(?=\/lobby\/)/i, '').replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(resolved.href);
  }
  return urls;
}

/**
 * Detect the lobby design from the DOM and return the matching page object.
 * Returns `null` when the page is neither the legacy nor the widget lobby
 * (e.g. an empty/marketing page).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @returns {Promise<LobbyGamesLaunchOldPage|LobbyGamesLaunchNewPage|null>}
 */
export async function detectLobbyPage(page, timeout = 12_000) {
  const legacy = page.locator('#js_lobby_main_wrapper'); // legacy lobby wrapper
  const widget = page.locator('#js_filter_button'); // widget-family lobby marker

  const outcome = await Promise.race([
    legacy
      .waitFor({ state: 'visible', timeout })
      .then(() => 'legacy')
      .catch(() => null),
    widget
      .waitFor({ state: 'visible', timeout })
      .then(() => 'widget')
      .catch(() => null),
  ]);

  if (outcome === 'legacy') return new LobbyGamesLaunchOldPage(page);
  if (outcome === 'widget') return new LobbyGamesLaunchNewPage(page);
  return null;
}

/** Close any popup/tab opened by a game launch (best effort, time-bounded). */
export async function closeGamePages(page) {
  const extras = page.context().pages().filter((p) => p !== page && !p.isClosed());
  if (!extras.length) return;
  // Closing a live game tab can take minutes (busy page / pending unload), so
  // never block the loop on it: race the closes against a short deadline.
  const closing = Promise.all(extras.map((p) => p.close().catch(() => {})));
  await Promise.race([closing, page.waitForTimeout(5_000)]).catch(() => {});
}
