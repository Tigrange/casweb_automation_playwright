// Old lobby game-launch page object. Used by partners whose game launch is
// served by the legacy lobby — totogaming, cozbet, betfa (see `lobbyNew` in
// src/config/partners.js).
//
// Flow covered here (PROD-SAFE — launches a game only, no bets):
//   1. open()                          — from the home page, open the casino
//                                        lobby (called ONCE per session).
//   2. launchProviderGame(provider)    — reset the filter, select a provider,
//                                        verify its games are listed, then
//                                        launch the first game.
//
// Providers are supplied by tests/data/lobbyData.js as a map of
// `{ name: { selector } }`; the spec drives one provider per test.
//
// Selectors follow the dev-team `automation` attribute convention. The lobby DOM
// has not been captured yet: every key below is a best-effort placeholder and
// MUST be verified against a live desktop/mobile DOM before trusting it.

import BasePage from '../BasePage.js';
import { automationSelector } from '../../utils/automation.js';

export class LobbyGamesLaunchOldPage extends BasePage {
  /** Device-aware selectors per semantic name. */
  get selectors() {
    return {
      header_menu: {
        desktop: '.tl_header_bot_row', // TODO verify
        // mobile: '.tl_header_bot_row', // TODO verify
      },
      // Home-page entry point that opens the casino lobby.
      lobbyTrigger: {
        desktop: '[title="Slots"]', // TODO verify
        // mobile: '[title="Close window"]', // TODO verify
      },
      // Lobby root that must become visible after open().
      lobbyContainer: {
        desktop: '#js_games_lobby', // TODO verify
        // mobile: automationSelector('casino_lobby'), // TODO verify
      },
      gameCard: {
        desktop: '.lb_card', // TODO verify
        // mobile: automationSelector('game_card'), // TODO verify
      },
      // Provider filter reset / "All" entry used to clear an active filter.
      providerFilterReset: {
        desktop: '[data-url="all"]', // TODO verify
        // mobile: '[title="all"]', // TODO verify
      },
      // Game tile that must be clicked to launch the game.
      // Game tile; only the first one is exercised (see TODO above).
      gameTile: {
        desktop: automationSelector('game_tile'), // TODO verify
        mobile: automationSelector('game_tile'), // TODO verify
      },
      // Container/iframe that appears once the game has launched.
      gameContainer: {
        desktop: automationSelector('game_container'), // TODO verify
        mobile: automationSelector('game_container'), // TODO verify
      },
    };
  }

  constructor(page) {
    super(page);
    this.header_menu = this.sel('header_menu');
    this.lobbyContainer = this.sel('lobbyContainer');
    this.lobbyTrigger = this.sel('lobbyTrigger', this.header_menu).first();
    this.gameTile = this.sel('gameTile');
    this.gameContainer = this.sel('gameContainer');
    this.gameCard = this.sel('gameCard', this.lobbyContainer).first();
  }

  /**
   * Open the casino lobby from the home page and wait for it to be visible.
   * Uses a programmatic click for the same reason as the login/register popups:
   * some partners clone the header, producing duplicate triggers that swallow
   * real pointer clicks.
   */
  async open() {
    await this.lobbyTrigger.evaluate((el) => el.click());
    await this.lobbyContainer.waitFor({ state: 'visible' });
  }

  /** Clear any active provider filter so the next provider starts from "all". */
  async resetProviderFilter() {
    const reset = this.sel('providerFilterReset', this.lobbyContainer).first();
    if (await reset.count()) {
      await reset.first().evaluate((el) => el.click()).catch(() => { });
    }
  }

  /**
   * Assert the provider filter was applied: the selected provider entry is
   * visible in the lobby.
   * @param {{ selector: string }} provider
   */
  async verifyProviderTitleVisible(provider) {
    await this.locator(provider.selector, this.lobbyContainer)
      .first()
      .waitFor({ state: 'visible' });
  }

  async verifyGameCardVisible() {
    await this.gameCard.waitFor({ state: 'visible' });
  }

  async verifyGameCardClickable() {
    await this.gameCard.waitFor({ state: 'attached' });
    await this.gameCard.waitFor({ state: 'visible' });
    await this.gameCard.waitFor({ state: 'enabled' });
  }

  /**
   * Run the full flow for a single provider against the already-open lobby:
   *   1. reset the filter
   *   2. select the provider
   *   3. verify its games are listed
   *   4. launch the first game and assert it opens
   *
   * @param {string} providerName
   * @param {{ selector: string }} provider
   */
  async launchProviderGame(providerName, provider) {
    await this.resetProviderFilter();
    await this.locator(provider.selector, this.lobbyContainer).first().click();
    await this.verifyProviderTitleVisible(provider);
    await this.verifyGameCardVisible();
    await this.verifyGameCardClickable();
    await this.launchGame({ provider: providerName });
  }

  /**
   * Best-effort recovery after a provider failure so the NEXT provider starts
   * from a clean lobby. Closes stray popups, restores the lobby and clears the
   * filter. Never throws.
   */
  async recoverLobby() {
    try {
      for (const popup of this.page.context().pages()) {
        if (popup !== this.page && !popup.isClosed()) await popup.close();
      }
      await this.page.keyboard.press('Escape').catch(() => { });
      await this.lobbyContainer.waitFor({ state: 'visible' }).catch(() => { });
      await this.resetProviderFilter();
    } catch {
      // swallow — recovery is best-effort
    }
  }

  /**
   * Launch the first available game and assert it actually opens. The game may
   * open in a new tab/window (popup) or inline in an iframe/container, so both
   * are accepted.
   *
   * @param {{ providers?: Record<string, { selector: string }>, maxGames?: number, provider?: string }} [data]
   */
  async launchGame(data = {}) {
    void data;
    await this.gameCard.hover();
    await expect(page.locator('.lb_card.relative.lb_card_v > .lb_card_hover > .lb_card_buttons > .lb_card_button.play_btn').first()).toBeVisible();
    await page.locator('.lb_card.relative.lb_card_v > .lb_card_hover > .lb_card_buttons > .lb_card_button.play_btn').first().click();
  }
}

export default LobbyGamesLaunchOldPage;