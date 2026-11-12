// Widget-based "new" lobby game-launch page object (design 2).
//
// Used by partners whose casino lobby is the widget lobby
// (`#js_filter_button` + `#js_wbp_filter`) — cozbet (see `lobbyNew` in
// src/config/partners.js).
//
// Flow (PROD-SAFE — launches a game only, never places a bet):
//   1. open(data)              — navigate to the widget lobby (data.lobbyUrl).
//   2. selectProvider(provider)— open the filter, switch to the Providers tab,
//                                pick the provider, then apply.
//   3. launchGame(game)         — launcher in the sibling class: find the
//                                specific game card, play it and assert the
//                                game iframe opened.
//
// Verified against TotoGaming TST (`/lobby/testslots`, 2026-11-05):
//   filter button   #js_filter_button
//   filter popup    #js_wbp_filter
//   providers tab   #js_filter_tab_provider_button
//   provider item   .js_wbp_filter_providers[data-unique-url="pragmatic"]
//   apply           #js_wbp_filter_show_all_games
//   games grid      #js_wbp_games_grid
//   game card       .js_dl_games_cont[data-game-id="17661"]
//   play            .js_dl_play

import { expect } from '@playwright/test';
import { LobbyGamesLaunchPage } from './LobbyGamesLaunchPage.js';

export class LobbyGamesLaunchNewPage extends LobbyGamesLaunchPage {
  /** Device-aware selectors per semantic name (new-lobby extras). */
  get selectors() {
    return {
      ...super.selectors,
      // Filter popup that narrows the widget lobby by provider.
      filterButton: {
        desktop: '#js_filter_button',
        mobile: '#js_filter_button', // TODO verify mobile
      },
      filterPopup: {
        desktop: '#js_wbp_filter',
        mobile: '#js_wbp_filter', // TODO verify mobile
      },
      providerTab: {
        desktop: '#js_filter_tab_provider_button',
        mobile: '#js_filter_tab_provider_button', // TODO verify mobile
      },
      providerItem: {
        desktop: '.js_wbp_filter_providers',
        mobile: '.js_wbp_filter_providers', // TODO verify mobile
      },
      applyFilter: {
        desktop: '#js_wbp_filter_show_all_games',
        mobile: '#js_wbp_filter_show_all_games', // TODO verify mobile
      },
      // Widget grid that replaces the legacy #js_games_lobby.
      gamesGrid: {
        desktop: '#js_wbp_games_grid',
        mobile: '#js_wbp_games_grid', // TODO verify mobile
      },
    };
  }

  constructor(page) {
    super(page);
    this.filterButton = this.page.locator(this.selectors.filterButton[this.device]).first();
    this.filterPopup = this.page.locator(this.selectors.filterPopup[this.device]);
    this.providerTab = this.page.locator(this.selectors.providerTab[this.device]).first();
    this.applyFilter = this.page.locator(this.selectors.applyFilter[this.device]).first();
    this.gamesGrid = this.page.locator(this.selectors.gamesGrid[this.device]);
  }

  /**
   * Open the widget lobby. The widget lobby is a standalone page, so it is
   * reached directly through `data.lobbyUrl` resolved against the current
   * origin (the page is expected to be on the partner site already).
   *
   * @param {{ lobbyUrl?: string }} [data]
   */
  async open(data = {}) {
    if (!data.lobbyUrl) {
      throw new Error('The new lobby requires `lobbyUrl` in the partner lobby data');
    }
    await this.page.goto(new URL(data.lobbyUrl, this.page.url()).href, {
      waitUntil: 'domcontentloaded',
    });
    await this.filterButton.waitFor({ state: 'visible' });
  }

  /** Open the filter popup on the Providers tab. */
  async openProviderFilter() {
    await this.filterButton.click();
    await this.filterPopup.waitFor({ state: 'visible' });
    await this.providerTab.click();
  }

  /** Apply the currently selected provider/themes and wait for the grid. */
  async applyProviderFilter() {
    // The filtered list is loaded via AJAX after applying; wait for it so the
    // first card picked is from THIS provider.
    const refresh = this.page
      .waitForResponse((r) => /WidgetBasedPage\/(Filter|FilterGames)/i.test(r.url()), {
        timeout: 15_000,
      })
      .catch(() => null);
    await this.applyFilter.click();
    await expect(this.filterPopup).toBeHidden();
    await refresh;
    await this.gamesGrid.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  /**
   * Apply a provider filter through the widget filter popup.
   * @param {{ name?: string, filter: string }} provider
   */
  async selectProvider(provider) {
    await this.openProviderFilter();

    const item = this.page
      .locator(`${this.selectors.providerItem[this.device]}[data-unique-url="${provider.filter}"]`)
      .first();
    await item.waitFor({ state: 'visible' });
    await item.click();
    await expect(item).toHaveClass(/active/);

    await this.applyProviderFilter();
  }

  /**
   * Whether the provider exists in the widget filter. Used to SKIP providers
   * that don't exist on the partner instead of failing.
   * @param {{ filter: string }} provider
   * @returns {Promise<boolean>}
   */
  async isProviderAvailable(provider) {
    const item = this.page
      .locator(`${this.selectors.providerItem[this.device]}[data-unique-url="${provider.filter}"]`)
      .first();
    if (!(await item.count())) return false;
    return !(await item
      .evaluate((el) => el.classList.contains('hidden') || el.hasAttribute('disabled'))
      .catch(() => false));
  }

  /**
   * Discover all providers in the widget filter (the popup exists in the DOM
   * even while closed). Used by the all-providers sweep.
   * @returns {Promise<{name: string, filter: string}[]>}
   */
  async listProviders() {
    const items = this.page.locator(`${this.selectors.providerItem[this.device]}[data-unique-url]`);
    const count = await items.count();
    const providers = [];
    for (let i = 0; i < count; i += 1) {
      const item = items.nth(i);
      const filter = await item.getAttribute('data-unique-url');
      if (!filter || filter === 'all') continue;
      const name = (await item.getAttribute('data-text')) || filter;
      providers.push({ name, filter });
    }
    return providers;
  }
}

export default LobbyGamesLaunchNewPage;
