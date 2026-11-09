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
      // Header menu link that opens the slots lobby.
      lobbyMenuLink: {
        desktop: 'a.js_menu_links[href*="/lobby/slots/main"]',
        mobile: 'a.js_menu_links[href*="/lobby/slots/main"]', // TODO verify mobile
      },
      // Lobby wrapper + inner filter/root.
      lobbyWrapper: {
        desktop: '#js_lobby_main_wrapper',
        mobile: '#js_lobby_main_wrapper', // TODO verify mobile
      },
      lobbyContainer: {
        desktop: '#js_lobby_main',
        mobile: '#js_lobby_main', // TODO verify mobile
      },
      // Provider chips carry the provider slug in `data-url`; `all` resets.
      providerItem: {
        desktop: '.js_lobby_cats',
        mobile: '.js_lobby_cats', // TODO verify mobile
      },
    };
  }

  constructor(page) {
    super(page);
    this.lobbyMenuLink = this.sel('lobbyMenuLink').first();
    this.lobbyWrapper = this.page.locator(this.selectors.lobbyWrapper[this.device]);
    this.gamesGrid = this.page.locator(this.selectors.gamesGrid[this.device]);
    this.providerItem = this.page.locator(this.selectors.providerItem[this.device]);
  }

  /**
   * Open the casino lobby from the home page.
   * Uses a programmatic click for the same reason as the auth popups: the
   * header is cloned on some partners and a real pointer click can be swallowed.
   *
   * @param {{ lobbyUrl?: string }} [data]
   */
  async open(data = {}) {
    if (data.lobbyUrl) {
      const link = this.page.locator(`a.js_menu_links[href*="${data.lobbyUrl}"]`).first();
      if (await link.count()) {
        await link.evaluate((el) => el.click());
      } else {
        await this.page.goto(new URL(data.lobbyUrl, this.page.url()).href, {
          waitUntil: 'domcontentloaded',
        });
      }
    } else {
      await this.lobbyMenuLink.evaluate((el) => el.click());
    }

    await this.lobbyWrapper.waitFor({ state: 'visible' });
    await this.gamesGrid.waitFor({ state: 'attached' });
  }

  /** Clear any active provider filter so the next provider starts from "all". */
  async resetProviderFilter() {
    const all = this.page.locator(`${this.selectors.providerItem[this.device]}[data-url="all"]`).first();
    if (await all.count()) {
      await all.evaluate((el) => el.click());
      await expect(all).toHaveClass(/active/);
    }
  }

  /**
   * Apply a provider filter and verify the provider chip became active.
   * @param {{ name?: string, filter: string }} provider
   */
  async selectProvider(provider) {
    const item = this.page
      .locator(`${this.selectors.providerItem[this.device]}[data-url="${provider.filter}"]`)
      .first();
    await item.waitFor({ state: 'visible' });

    const isActive = await item.evaluate((el) => el.classList.contains('active'));
    if (!isActive) await item.evaluate((el) => el.click());

    await expect(item).toHaveClass(/active/);
    await this.gamesGrid.waitFor({ state: 'visible' });
  }
}

export default LobbyGamesLaunchOldPage;
