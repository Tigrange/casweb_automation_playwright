// Legacy lobby game-launch page object (design 1).
//
// Used by partners whose casino lobby is the classic `#js_lobby_main_wrapper`
// page — totogaming, totoro, betfa, manoto (see `lobbyNew` in
// src/config/partners.js).
//
// Flow (PROD-SAFE — launches a game only, never places a bet):
//   1. open(data)              — from the home page open the casino lobby
//                                (optionally via data.lobbyUrl).
//   2. selectProvider(provider)— click the provider chip in the lobby filter.
//   3. launchGame(game)         — launcher in the sibling class: find the
//                                specific game card, play it and assert the
//                                game iframe opened.
//
// Verified against TotoGaming TST (2026-11-05):
//   lobby link      a.js_menu_links[href="/lobby/slots/main"]
//   wrapper         #js_lobby_main_wrapper
//   filter root     #js_lobby_main
//   provider chip   .js_lobby_cats[data-url="pragmatic"]
//   games grid      #js_games_lobby
//   game card       .js_dl_games_cont[data-game-id="17661"]
//   play            .js_dl_play

import { expect } from '@playwright/test';
import { LobbyGamesLaunchPage } from './LobbyGamesLaunchPage.js';

export class LobbyGamesLaunchOldPage extends LobbyGamesLaunchPage {
  /** Device-aware selectors per semantic name (old-lobby extras). */
  get selectors() {
    return {
      ...super.selectors,
      // Lobby wrapper + inner filter/root.
      lobbyWrapper: {
        desktop: '#js_lobby_main_wrapper',
        mobile: '#js_lobby_main_wrapper', // TODO verify mobile
      },
      // Provider chips carry the provider slug in `data-url`.
      providerItem: {
        desktop: '.js_lobby_cats',
        mobile: '.js_lobby_cats', // TODO verify mobile
      },
      // "View all providers" control (prod collapses some providers).
      providersViewAll: {
        desktop: '#js_lobby_view_all_providers, .js_lobby_view_all_providers',
        mobile: '#js_lobby_view_all_providers, .js_lobby_view_all_providers', // TODO verify mobile
      },
      // Provider chip logo (alt text = provider name).
      providerImage: {
        desktop: 'img',
        mobile: 'img',
      },
    };
  }

  constructor(page) {
    super(page);
    this.lobbyWrapper = this.page.locator(this.selectors.lobbyWrapper[this.device]);
    this.gamesGrid = this.page.locator(this.selectors.gamesGrid[this.device]);
  }

  /**
   * Open the casino lobby directly from the configured lobby URL. Direct
   * navigation is used because the lobby path/host differs per environment
   * (test `/lobby/slots/main`, prod `/lobby/casino/main`).
   *
   * @param {{ lobbyUrl?: string }} [data]
   */
  async open(data = {}) {
    if (!data.lobbyUrl) {
      throw new Error('The legacy lobby requires `lobbyUrl` in the partner lobby data');
    }
    await this.page.goto(new URL(data.lobbyUrl, this.page.url()).href, {
      waitUntil: 'domcontentloaded',
    });

    await this.lobbyWrapper.waitFor({ state: 'visible' });
    await this.gamesGrid.waitFor({ state: 'attached' });
  }

  /**
   * Apply a provider filter and verify the provider chip became active.
   * @param {{ name?: string, filter: string }} provider
   */
  async selectProvider(provider) {
    const item = this.page
      .locator(`${this.selectors.providerItem[this.device]}[data-url="${provider.filter}"]`)
      .first();

    // Some providers are collapsed behind "show all providers" (prod).
    if (!(await item.isVisible().catch(() => false))) {
      const viewAll = this.page
        .locator(this.selectors.providersViewAll[this.device])
        .first();
      if (await viewAll.count()) {
        await viewAll.evaluate((el) => el.click()).catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }
    await item.waitFor({ state: 'visible', timeout: 15_000 });

    const isActive = await item.evaluate((el) => el.classList.contains('active'));
    if (!isActive) {
      // The filtered game list is loaded via AJAX after the chip click; wait for
      // that response so the first card we pick is from THIS provider.
      const refresh = this.page
        .waitForResponse((r) => /DynamicLobbyHelper\/GetGames/i.test(r.url()), {
          timeout: 15_000,
        })
        .catch(() => null);
      await item.evaluate((el) => el.click());
      await refresh;
    }

    await expect(item).toHaveClass(/active/);
    await this.page
      .waitForURL((url) => url.href.includes(`/${provider.filter}`), { timeout: 10_000 })
      .catch(() => {});
    await this.gamesGrid.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  /**
   * Whether the provider is enabled/visible in the lobby filter. Providers that
   * are collapsed behind "show all providers" are revealed first. Used to SKIP
   * providers that don't exist on the partner instead of failing.
   * @param {{ filter: string }} provider
   * @returns {Promise<boolean>}
   */
  async isProviderAvailable(provider) {
    const item = this.page
      .locator(`${this.selectors.providerItem[this.device]}[data-url="${provider.filter}"]`)
      .first();
    if (await item.isVisible().catch(() => false)) return true;

    const viewAll = this.page.locator(this.selectors.providersViewAll[this.device]).first();
    if (await viewAll.count()) {
      await viewAll.evaluate((el) => el.click()).catch(() => {});
      await this.page.waitForTimeout(800);
    }
    return item.isVisible().catch(() => false);
  }

  /**
   * Discover all ENABLED providers in the lobby filter. Used by the
   * all-providers sweep so new providers are covered without hardcoding.
   * @returns {Promise<{name: string, filter: string}[]>}
   */
  async listProviders() {
    const items = this.page.locator(`${this.selectors.providerItem[this.device]}[data-url]`);
    const count = await items.count();
    const providers = [];
    for (let i = 0; i < count; i += 1) {
      const item = items.nth(i);
      if (!(await item.isVisible().catch(() => false))) continue;
      const filter = await item.getAttribute('data-url');
      if (!filter || filter === 'all') continue;
      const name =
        (await item
          .locator(this.selectors.providerImage[this.device])
          .first()
          .getAttribute('alt')
          .catch(() => null)) || (await item.textContent())?.trim() || filter;
      providers.push({ name, filter });
    }
    return providers;
  }
}

export default LobbyGamesLaunchOldPage;
