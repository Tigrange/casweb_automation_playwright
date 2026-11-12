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
//   · .js_game_view_item_inner iframe         the real provider iframe (success)
//   · .error__img / .error__texts             RGS failure page (fast failure)
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
      // test env uses `.js_dl_games_cont`, prod uses `.js_dl_games`.
      gameCard: {
        desktop: '.js_dl_games_cont, .js_dl_games',
        mobile: '.js_dl_games_cont, .js_dl_games', // TODO verify mobile
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
      // Success container for the wrapped game view: the provider iframe is
      // inside `.js_game_view_item_inner`.
      launchIframe: {
        desktop: '.js_game_view_item_inner iframe',
        mobile: '.js_game_view_item_inner iframe', // TODO verify mobile
      },
      // KYC gate; when visible the game cannot be launched for this player.
      verificationPopup: {
        desktop: '#verification_popup',
        mobile: '#verification_popup',
      },
      // RGS/provider failure state. On failure the play page can redirect to the
      // RGS error page (`.error__img` + `.error__texts`) instead of creating the
      // game iframe, so this lets us fail fast with the provider message.
      gameError: {
        desktop: '.error__img',
        mobile: '.error__img',
      },
      gameErrorText: {
        desktop: '.error__texts',
        mobile: '.error__texts',
      },
      // Blocked/restricted player page (e.g. "Your account is temporarily
      // restricted. Please, contact Customer Support. Code 520").
      blockedError: {
        desktop: '.invalid_validation_error',
        mobile: '.invalid_validation_error',
      },
      // Card cover image (used to read the game name for test titles).
      gameCardImage: {
        desktop: 'img',
        mobile: 'img', // TODO verify mobile
      },
      // Any iframe (direct-provider game detection).
      anyIframe: {
        desktop: 'iframe',
        mobile: 'iframe',
      },
      // Wrapped game-view item; the game iframe lives inside it.
      gameViewInner: {
        desktop: '.js_game_view_item_inner',
        mobile: '.js_game_view_item_inner', // TODO verify mobile
      },
      // Canvas game surface (Amusnet renders the game directly on a canvas).
      gameCanvas: {
        desktop: 'canvas',
        mobile: 'canvas', // TODO verify mobile
      },
      // Frame body (used to read rendered error/text content).
      bodyText: {
        desktop: 'body',
        mobile: 'body',
      },
      // Promo/cookie overlays that intercept pointer events.
      overlays: {
        desktop: '.ui-widget-overlay, #canvas-popup, .dyn_popUp_root',
        mobile: '.ui-widget-overlay, #canvas-popup, .dyn_popUp_root', // TODO verify mobile
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
  async visibleGameCard(game, timeout = 20_000) {
    const cards = this.gameCard(game);
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const count = await cards.count();
      for (let i = 0; i < count; i += 1) {
        const card = cards.nth(i);
        if (await card.isVisible().catch(() => false)) return card;
      }
      // The provider grid loads asynchronously after the filter; poll for it.
      await this.page.waitForTimeout(300);
    }
    throw new Error(`Game card not found/visible for game id ${game.id} (${game.name || 'unknown'})`);
  }

  /** FIRST VISIBLE card from the provider-filtered grid (real-flow selection). */
  async firstVisibleGameCard(timeout = 20_000) {
    const cards = this.page.locator(
      `${this.selectors.gamesGrid[this.device]} ${this.selectors.gameCard[this.device]}`,
    );

    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const count = await cards.count();
      for (let i = 0; i < count; i += 1) {
        const card = cards.nth(i);
        if (await card.isVisible().catch(() => false)) return card;
      }
      await this.page.waitForTimeout(300);
    }
    throw new Error('No visible game cards available after the provider filter');
  }

  /** Read the game identity from a card, preferring the pinned data when given. */
  async gameInfoFromCard(card, pinned = {}) {
    const id = await card.getAttribute('data-game-id');
    const name =
      pinned.name ||
      (await card
        .locator(this.selectors.gameCardImage[this.device])
        .first()
        .getAttribute('alt')
        .catch(() => null));
    return { id, name };
  }

  /** Remove common promo/cookie overlays that intercept pointer events. */
  async dismissOverlays(page = this.page) {
    const selector = this.selectors.overlays[this.device];
    await page
      .evaluate((sel) => {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      }, selector)
      .catch(() => {});
  }

  /**
   * Launch a game and assert it actually opened.
   *
   * When `game` is provided the specific card is used (debugging a known game).
   * When it is omitted the FIRST game from the provider-filtered grid is
   * launched — this is the real-flow behaviour after filtering a provider.
   *
   * The game may open inline (same tab) or in a popup/new tab, so both are
   * accepted. A rendered launch UI alone is NOT enough: the provider launch
   * request can fail (e.g. 404) and the iframe can show a server-error page
   * while `data-has-game`, `data-game-id` and the iframe src all look valid.
   *
   * @param {{ id?: string|number, name?: string } | null} [game]
   */
  async launchGame(game = null) {
    await this.dismissOverlays();

    // Resolve the card + play target with retries: the lobby re-renders its
    // sliders/grids, so a resolved card can get detached between steps.
    let card;
    let play;
    let resolvedGame;
    let targetUrl;
    for (let attempt = 1; attempt <= 3 && !targetUrl; attempt += 1) {
      try {
        card = game && game.id ? await this.visibleGameCard(game) : await this.firstVisibleGameCard();
        resolvedGame = await this.gameInfoFromCard(card, game || {});

        // Play anchor (test env): prefer its href/data-href.
        play = this.sel('playButton', card).first();
        if (await play.count()) {
          targetUrl =
            (await play.getAttribute('href')) || (await play.getAttribute('data-href'));
        }

        // Prod cards have no play anchor; they carry `data-href` on the card.
        if (!targetUrl) {
          const cardHref = await card.getAttribute('data-href').catch(() => null);
          if (cardHref) {
            const lang = this.page.url().match(/\/\/[^/]+\/([a-z]{2})(?:\/|$)/i)?.[1];
            targetUrl = `${lang ? `/${lang}` : ''}/play/real/${cardHref}`;
          }
        }
      } catch {
        await this.page.waitForTimeout(500);
      }
    }
    if (!resolvedGame) {
      throw new Error(`Could not resolve game card for ${game?.id || 'first provider game'}`);
    }

    // Capture provider launch responses BEFORE clicking: the launch request
    // starts immediately after the click and can complete very fast. Redirect
    // hops are not emitted, so collect everything and fail on a >=400 below.
    const context = this.page.context();
    const launchResponses = [];
    const onResponse = (response) => {
      // RGS launch URL variants:
      //   .../routing-launch/Games/Launch/V5?...  (legacy RGS routing)
      //   .../GamesLaunch/Launch?...              (RGS API variant)
      //   .../Games/Launch/V5?...                 (successful RGS launcher, e.g. launchdigi.net)
      if (
        /(routing-launch\/Games\/Launch|GamesLaunch\/Launch|\/Games\/Launch\/V\d)/i.test(
          response.url(),
        )
      ) {
        launchResponses.push(response);
      }
    };
    context.on('response', onResponse);

    const popupPromise = this.page.waitForEvent('popup', { timeout: 8_000 }).catch(() => null);

    // Prefer the play target URL (`href` or `data-href`). Opening it directly is
    // reliable: it bypasses promo/announcement overlays and popup blocking,
    // while still launching the exact game selected after the provider filter.
    if (targetUrl) {
      await this.page.goto(new URL(targetUrl, this.page.url()).href, {
        waitUntil: 'domcontentloaded',
      });
      // The production play page may open the game in a NEW TAB.
      const popup = await Promise.race([
        popupPromise,
        this.page.waitForTimeout(8_000).then(() => null),
      ]);
      this.activePage = popup || this.page;
    } else {
      // Fallback for JS-only play buttons: real user-gesture click first so a
      // provider calling window.open is not popup-blocked.
      try {
        await play.click({ timeout: 10_000 });
      } catch {
        await this.dismissOverlays();
        try {
          await play.click({ timeout: 10_000, force: true });
        } catch {
          await play.evaluate((el) => el.click());
        }
      }
      const popup = await popupPromise;
      this.activePage = popup || this.page;
    }

    try {
      await this.expectGameLaunched(resolvedGame, launchResponses);
    } finally {
      context.off('response', onResponse);
    }
  }

  /**
   * Find a visible, "real" game iframe. Direct-launch providers (Pragmatic,
   * Amusnet/EGT) can render the provider game in a bare iframe without the
   * `#js_game_view_cont` wrapper, so this is the alternative launch signal.
   */
  async findGameIframe(page = this.activePage) {
    const iframes = page.locator(this.selectors.anyIframe[this.device]);
    const count = await iframes.count();
    for (let i = 0; i < count; i += 1) {
      const iframe = iframes.nth(i);
      if (!(await iframe.isVisible().catch(() => false))) continue;
      const src = await iframe.getAttribute('src');
      if (!src || src === 'about:blank' || !/^https?:/i.test(src)) continue;
      const box = await iframe.boundingBox().catch(() => null);
      if (!box || box.width < 250 || box.height < 150) continue;
      return iframe;
    }
    return null;
  }

  /** Poll for the game iframe until it appears or the timeout elapses. */
  async waitForGameIframe(page = this.activePage, timeout = 30_000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const iframe = await this.findGameIframe(page);
      if (iframe) return iframe;
      await page.waitForTimeout(500);
    }
    return null;
  }

  /** Read the RGS/provider error message (`.error__texts`) when present. */
  async readGameErrorText(page = this.activePage) {
    const text = await page
      .locator(this.selectors.gameErrorText[this.device])
      .first()
      .innerText({ timeout: 3_000 })
      .catch(() => '');
    return text.trim().replace(/\s+/g, ' ').slice(0, 200);
  }

  /** Read the blocked/restricted player message (`.invalid_validation_error`). */
  async readBlockedError(root = this.activePage) {
    const text = await root
      .locator(this.selectors.blockedError[this.device])
      .first()
      .innerText({ timeout: 3_000 })
      .catch(() => '');
    return text.trim().replace(/\s+/g, ' ').slice(0, 200);
  }

  /**
   * Assert the launched-game contract. The launch UI appears in one of two
   * shapes depending on the provider:
   *   · wrapped  — RGS V5/V3 / game-view page: `#js_game_view_cont` +
   *                `.js_game_view_item[data-game-id]` + inner iframe
   *   · direct   — Pragmatic / Amusnet render a bare provider game iframe
   *
   * In both cases: no verification gate, no failed launch request (>=400),
   * a real iframe src, and no provider error page inside the iframe.
   *
   * @param {{ id?: string|number, name?: string }} game
   * @param {import('@playwright/test').Response[]} [launchResponses]
   */
  async expectGameLaunched(game, launchResponses = []) {
    const page = this.activePage;
    const launchContainer = page.locator(this.selectors.launchContainer[this.device]);
    const verification = page.locator(this.selectors.verificationPopup[this.device]);
    // RGS failures can redirect the top page to the RGS error page where
    // `.error__img` is shown and no game iframe/container exists — check it
    // globally so we fail fast with the provider message.
    const gameError = page.locator(this.selectors.gameError[this.device]).first();
    // Blocked/restricted player page can replace the game page after redirect.
    const blockedError = page.locator(this.selectors.blockedError[this.device]).first();

    const directIframe = this.waitForGameIframe(page, 30_000).catch(() => null);

    const outcome = await Promise.race([
      launchContainer
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'wrapped')
        .catch(() => null),
      directIframe.then((iframe) => (iframe ? 'direct' : null)),
      verification
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'verification')
        .catch(() => null),
      gameError
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'error')
        .catch(() => null),
      blockedError
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'blocked')
        .catch(() => null),
    ]);

    if (outcome === 'blocked') {
      const detail = await this.readBlockedError(page);
      throw new Error(
        `Game launch blocked for player for game ${game.id} (${game.name || 'unknown'}): ` +
          `account restricted (.invalid_validation_error)${detail ? ` — ${detail}` : ''}`,
      );
    }
    if (outcome === 'error') {
      const detail = await this.readGameErrorText(page);
      throw new Error(
        `Game did not launch for game ${game.id} (${game.name || 'unknown'}): ` +
          `provider error page (.error__img)${detail ? ` — ${detail}` : ''}`,
      );
    }
    if (outcome === 'verification') {
      throw new Error(
        'Game launch blocked by account verification (#verification_popup). ' +
          'A verified player is required for lobby game-launch tests.',
      );
    }
    if (!outcome) {
      throw new Error(
        `Game launch UI/iframe not found for game ${game.id} (${game.name || 'unknown'}) ` +
          `on ${page.url()}`,
      );
    }

    let iframe;
    if (outcome === 'wrapped') {
      const launchedItem = page.locator(this.selectors.launchItem[this.device]).first();
      await expect(launchedItem).toHaveAttribute('data-has-game', 'true');
      if (game.id !== undefined && game.id !== null) {
        await expect(launchedItem).toHaveAttribute('data-game-id', String(game.id));
      }

      // RGS/provider failure: the play URL can redirect to the RGS error page
      // (`.error__img`) instead of creating the inner iframe. Race the two so a
      // failed RGS launch fails immediately with a clear provider message.
      iframe = page.locator(this.selectors.launchIframe[this.device]).first();
      const wrappedOutcome = await Promise.race([
        iframe
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => 'iframe')
          .catch(() => null),
        gameError
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => 'error')
          .catch(() => null),
        blockedError
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => 'blocked')
          .catch(() => null),
      ]);
      if (wrappedOutcome === 'blocked') {
        const detail = await this.readBlockedError(page);
        throw new Error(
          `Game launch blocked for player for game ${game.id} (${game.name || 'unknown'}): ` +
            `account restricted (.invalid_validation_error)${detail ? ` — ${detail}` : ''}`,
        );
      }
      if (wrappedOutcome === 'error') {
        const detail = await this.readGameErrorText(page);
        throw new Error(
          `Game did not launch for game ${game.id} (${game.name || 'unknown'}): ` +
            `provider error page (.error__img)${detail ? ` — ${detail}` : ''}`,
        );
      }
      if (wrappedOutcome !== 'iframe') {
        throw new Error(
          `Game launch iframe (.js_game_view_item_inner iframe) not found for game ` +
            `${game.id} (${game.name || 'unknown'}) on ${page.url()}`,
        );
      }
    } else {
      iframe = (await directIframe) || (await this.waitForGameIframe(page, 5_000));
      if (!iframe) {
        // The page may have redirected to a blocked-player or provider error page.
        if (await blockedError.isVisible().catch(() => false)) {
          const detail = await this.readBlockedError(page);
          throw new Error(
            `Game launch blocked for player for game ${game.id} (${game.name || 'unknown'}): ` +
              `account restricted (.invalid_validation_error)${detail ? ` — ${detail}` : ''}`,
          );
        }
        if (await gameError.isVisible().catch(() => false)) {
          const detail = await this.readGameErrorText(page);
          throw new Error(
            `Game did not launch for game ${game.id} (${game.name || 'unknown'}): ` +
              `provider error page (.error__img)${detail ? ` — ${detail}` : ''}`,
          );
        }
        throw new Error(
          `Direct-launch game iframe not found for game ${game.id} (${game.name || 'unknown'})`,
        );
      }
    }

    const src = await iframe.getAttribute('src');
    expect(src, 'launched game iframe must have a real src').toBeTruthy();
    expect(src).not.toBe('about:blank');

    // Wait for the iframe navigation to settle so both the launch response and
    // the rendered content are available before asserting.
    const handle = await iframe.elementHandle();
    const frame = handle ? await handle.contentFrame() : null;
    if (frame) {
      await frame.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    }
    await page.waitForTimeout(1_500);

    // A failed provider launch request (e.g. 404) is exactly the "DOM looks
    // fine but the game never loads" failure mode.
    const failedResponse = launchResponses.find((response) => response.status() >= 400);
    if (failedResponse) {
      throw new Error(
        `Game launch request failed for game ${game.id} (${game.name || 'unknown'}): ` +
          `${failedResponse.status()} ${failedResponse.request().method()} ${failedResponse.url()}`,
      );
    }

    if (!frame) return;

    // The game iframe itself may render the blocked/restricted player page.
    if (await frame.locator(this.selectors.blockedError[this.device]).first().isVisible().catch(() => false)) {
      const detail = await this.readBlockedError(frame);
      throw new Error(
        `Game launch blocked for player for game ${game.id} (${game.name || 'unknown'}): ` +
          `account restricted (.invalid_validation_error)${detail ? ` — ${detail}` : ''}`,
      );
    }

    // Is the game iframe inside the wrapped launcher (`.js_game_view_item_inner`)?
    //   · wrapped (RGS + Pragmatic/Amusnet launcher): success → nested iframe;
    //     failure → no nested iframe (often `.error__img`).
    //   · direct bare iframe (e.g. Amusnet): the iframe IS the game, so success
    //     is "content is not an error page".
    const gameViewInner = this.selectors.gameViewInner[this.device];
    const isWrapped = await iframe
      .evaluate((el, sel) => !!(el.closest && el.closest(sel)), gameViewInner)
      .catch(() => false);

    if (isWrapped) {
      // Success = the outer launcher frame renders a game surface: either a
      // NESTED iframe (RGS/Pragmatic) or a CANVAS (Pragmatic/Amusnet).
      const nestedIframe = frame.locator(this.selectors.anyIframe[this.device]).first();
      const canvas = frame.locator(this.selectors.gameCanvas[this.device]).first();
      const frameErrorImg = frame.locator(this.selectors.gameError[this.device]).first();
      const frameErrorText = frame
        .getByText(
          /sorry, an error has occurred|requested game is not active|error code|contact casino support|contact customer support|game is not active|temporarily restricted|account is .*restricted/i,
        )
        .first();

      const frameOutcome = await Promise.race([
        nestedIframe
          .waitFor({ state: 'attached', timeout: 30_000 })
          .then(() => 'game-surface')
          .catch(() => null),
        canvas
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => 'game-surface')
          .catch(() => null),
        frameErrorImg
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => 'error-img')
          .catch(() => null),
        frameErrorText
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => 'error-text')
          .catch(() => null),
      ]);

      if (frameOutcome === 'game-surface') return;

      const detail =
        (
          await frame
            .locator(this.selectors.gameErrorText[this.device])
            .first()
            .innerText({ timeout: 2_000 })
            .catch(() => '')
        ).trim() ||
        (await frame
          .locator(this.selectors.bodyText[this.device])
          .innerText({ timeout: 3_000 })
          .catch(() => '')).trim();

      const reason =
        frameOutcome === 'error-img'
          ? 'provider error state (.error__img)'
          : frameOutcome === 'error-text'
            ? 'provider error message'
            : 'outer iframe has no nested game iframe and no canvas';

      throw new Error(
        `Game did not launch for game ${game.id} (${game.name || 'unknown'}): ` +
          reason +
          (detail ? ` — ${detail.replace(/\s+/g, ' ').slice(0, 200)}` : ''),
      );
    }

    // Direct bare iframe: it must not render a provider error state/page.
    const errorSelector = `${this.selectors.gameError[this.device]}, ${this.selectors.gameErrorText[this.device]}`;
    const errorNodes = await frame
      .locator(errorSelector)
      .count()
      .catch(() => 0);

    const bodyText = await frame
      .locator(this.selectors.bodyText[this.device])
      .innerText({ timeout: 5_000 })
      .catch(() => '');
    const errorText =
      /server error|file or directory not found|page not found|resource you are looking for|error code|requested game is not active|game is not active|contact customer support|an error has occurred|temporarily restricted|account is .*restricted/i.test(
        bodyText,
      );

    if (errorNodes > 0 || errorText) {
      throw new Error(
        `Game iframe shows an error page for game ${game.id} (${game.name || 'unknown'}): ` +
          `${bodyText.trim().replace(/\s+/g, ' ').slice(0, 200) || 'provider error state'}`,
      );
    }
  }
}

export default LobbyGamesLaunchPage;
