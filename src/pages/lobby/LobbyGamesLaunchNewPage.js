// New lobby game-launch page object. Used by partners whose game launch is
// served by the new lobby — totoro (see `lobbyNew` in src/config/partners.js).
//
// The new lobby is a self-contained launcher. As with the new cashier, we only
// assert that the launch UI OPENS: an internal "something went wrong"/provider
// error is a partner-side issue and still counts as a PASS — the integration
// from our side works as long as the launch container is displayed.
//
// TODO: eventually launch games across MULTIPLE providers (>5), filtering per
// provider first. Deferred for now.
//
// Selectors follow the dev-team `automation` attribute convention. The lobby DOM
// has not been captured yet: every key below is a best-effort placeholder and
// MUST be verified against a live desktop/mobile DOM before trusting it.

import BasePage from '../BasePage.js';
import { automationSelector } from '../../utils/automation.js';

export class LobbyGamesLaunchNewPage extends BasePage {
  /** Device-aware selectors per semantic name. */
  get selectors() {
    return {
      // Home-page entry point that opens the casino lobby.
      lobbyTrigger: {
        desktop: automationSelector('casino_main_button'), // TODO verify
        mobile: automationSelector('casino_main_button'), // TODO verify
      },
      // Launch container/iframe that must become visible after open().
      launchContainer: {
        desktop: automationSelector('game_launch'), // TODO verify
        mobile: automationSelector('game_launch'), // TODO verify
      },
    };
  }

  constructor(page) {
    super(page);
    this.launchContainer = this.sel('launchContainer');
    this.openTrigger = this.sel('lobbyTrigger').first();
  }

  /**
   * Open the game launcher from the home page. Uses a programmatic click for the
   * same reason as the login/register popups (duplicate cloned header triggers).
   */
  async open() {
    await this.openTrigger.evaluate((el) => el.click());
  }

  /**
   * Assert the launch UI opened. Intentionally does NOT inspect its contents:
   * an in-container provider error is a partner-side problem, not ours.
   *
   * @param {{ providers?: string[], maxGames?: number }} [data] reserved for the
   *   multi-provider TODO.
   */
  async launchGame(data = {}) {
    void data;
    await this.launchContainer.waitFor({ state: 'visible' });
  }
}

export default LobbyGamesLaunchNewPage;
