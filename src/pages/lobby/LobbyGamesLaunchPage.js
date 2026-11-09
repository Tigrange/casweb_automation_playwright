// Shared base for the LOBBY game-launch page objects.
//
// Cazweb serves TWO different lobby designs. Both are "open the lobby, filter a
// provider, launch one game and verify it really opened", so the launch/verify
// logic lives here and each design subclass only implements its own navigation,
// provider filter and (if it differs) grid selectors:
//
//   LobbyGamesLaunchOldPage  legacy lobby  (totogaming, totoro, betfa, manoto)
//   LobbyGamesLaunchNewPage  widget lobby  (cozbet)
//
// Success contract (from the TotoGaming investigation / Obsidian "Launch Game
// test"):
//   · #js_game_view_cont                     launch container
//   · .js_game_view_item[data-has-game]       launched-game descriptor
//   · #js_game_view_inner_cont iframe         the real provider iframe
// A visible `#verification_popup` means the KYC gate blocked the launch; that
// is reported as a clear incident instead of a confusing timeout.
//
// Selectors use stable hooks only: element ids, data attributes and JS
// behaviour classes (`js_*`), never styling-only classes.

import { expect } from '@playwright/test';
import BasePage from '../BasePage.js';

export class LobbyGamesLaunchPage extends BasePage {
  /** Device-aware selectors per semantic name. */
  get selectors() {
    return {
      // Grid holding the game cards for the active provider.
      gamesGrid: {
        desktop: '#js_games_lobby',
        mobile: '#js_games_lobby', // TODO verify mobile
      },
      // One game card; the concrete game is selected by `data-game-id`.
      gameCard: {
        desktop: '.js_dl_games_cont',
        mobile: '.js_dl_games_cont', // TODO verify mobile
      },
      // Play anchor inside a card.
      playButton: {
        desktop: '.js_dl_play',
        mobile: '.js_dl_play', // TODO verify mobile
      },
      // Launch UI that appears once the game is opened.
      launchContainer: {
        desktop: '#js_game_view_cont',
        mobile: '#js_game_view_cont', // TODO verify mobile
      },
      launchItem: {
        desktop: '.js_game_view_item',
        mobile: '.js_game_view_item', // TODO verify mobile
      },
      launchIframeWrap: {
        desktop: '#js_game_view_inner_cont',
        mobile: '#js_game_view_inner_cont', // TODO verify mobile
      },
      launchIframe: {
        desktop: '#js_game_view_inner_cont iframe',
        mobile: '#js_game_view_inner_cont iframe', // TODO verify mobile
      },
      // KYC gate; when visible the game cannot be launched for this player.
      verificationPopup: {
        desktop: '#verification_popup',
        mobile: '#verification_popup',
      },
    };
  }

  constructor(page) {
    super(page);
    /** Page/tab that actually hosts the launched game (may be a popup). */
    this.activePage = page;
  }

  /** Open the lobby. Implemented per design. @param {object} [data] */
  async open(data = {}) {
    void data;
    throw new Error('open() must be implemented by the lobby design subclass');
  }

  /** Reset the provider filter to "all". Implemented per design. */
  async resetProviderFilter() {
    throw new Error('resetProviderFilter() must be implemented by the lobby design subclass');
  }

  /** Apply a provider filter. Implemented per design. @param {{filter: string}} provider */
  async selectProvider(provider) {
    void provider;
    throw new Error('selectProvider() must be implemented by the lobby design subclass');
  }

  /** Locator for the specific game card (`data-game-id`). */
  gameCard(game) {
    return this.page.locator(`${this.selectors.gameCard[this.device]}[data-game-id="${game.id}"]`);
  }

  /** Return the first VISIBLE card for `game` (cards can be duplicated in sliders). */
  async visibleGameCard(game) {
    const cards = this.gameCard(game);
    const count = await cards.count();
    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      if (await card.isVisible().catch(() => false)) return card;
    }
    throw new Error(`Game card not found/visible for game id ${game.id} (${game.name || 'unknown'})`);
  }

  /**
   * Launch the configured game and assert it actually opened.
   *
   * The game may open inline (same tab) or in a popup/new tab, so both are
   * accepted. An in-container provider error is surfaced by the verification
   * step (missing iframe / no launch container).
   *
   * @param {{ id: string|number, name?: string }} game
   */
  async launchGame(game) {
    const card = await this.visibleGameCard(game);
    await card.scrollIntoViewIfNeeded();
    await card.hover();

    const play = card.locator(this.selectors.playButton[this.device]).first();
    await play.waitFor({ state: 'visible' });

    const popupPromise = this.page.waitForEvent('popup', { timeout: 8_000 }).catch(() => null);
    // Real click first; fall back to a programmatic click when a cookie/promo
    // overlay swallows the pointer event (same idiom as the auth/cashier pages).
    try {
      await play.click({ timeout: 10_000 });
    } catch {
      await play.evaluate((el) => el.click());
    }
    const popup = await popupPromise;
    this.activePage = popup || this.page;

    await this.expectGameLaunched(game);
  }

  /**
   * Assert the launched-game contract:
   *   · the launch container is visible (or a verification gate was shown)
   *   · the launched item is marked as launched and matches the game id
   *   · the provider iframe exists, is visible and has a real src
   *
   * @param {{ id: string|number, name?: string }} game
   */
  async expectGameLaunched(game) {
    const page = this.activePage;
    const launchContainer = page.locator(this.selectors.launchContainer[this.device]);
    const verification = page.locator(this.selectors.verificationPopup[this.device]);

    const outcome = await Promise.race([
      launchContainer
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'launched')
        .catch(() => null),
      verification
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'verification')
        .catch(() => null),
    ]);

    if (outcome === 'verification') {
      throw new Error(
        'Game launch blocked by account verification (#verification_popup). ' +
          'A verified player is required for lobby game-launch tests.',
      );
    }
    if (outcome !== 'launched') {
      throw new Error(
        `Game launch UI not found for game ${game.id} (${game.name || 'unknown'}) ` +
          `on ${page.url()}`,
      );
    }

    const launchedItem = page.locator(this.selectors.launchItem[this.device]).first();
    await expect(launchedItem).toHaveAttribute('data-has-game', 'true');
    await expect(launchedItem).toHaveAttribute('data-game-id', String(game.id));

    const iframe = page.locator(this.selectors.launchIframe[this.device]).first();
    await iframe.waitFor({ state: 'visible', timeout: 30_000 });
    const src = await iframe.getAttribute('src');
    expect(src, 'launched game iframe must have a real src').toBeTruthy();
    expect(src).not.toBe('about:blank');
  }
}

export default LobbyGamesLaunchPage;
