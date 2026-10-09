// Lobby game-launch page-object registry. Selects the right launcher
// implementation per partner — mirrors src/factories/cashierRegistry.js.
//
// The choice comes from the partner config (`lobbyNew` in
// src/config/partners.js): true → the new lobby launcher, false/absent → the
// legacy lobby flow.
//
//   lobbyNew: true   totoro
//   lobbyNew: false  totogaming, cozbet, betfa

import { PARTNERS } from '../config/partners.js';
import { LobbyGamesLaunchOldPage } from '../pages/lobby/LobbyGamesLaunchOldPage.js';
import { LobbyGamesLaunchNewPage } from '../pages/lobby/LobbyGamesLaunchNewPage.js';

/**
 * Return a lobby game-launch page object for the given partner.
 * @param {import('@playwright/test').Page} page
 * @param {string} [partnerId]
 * @returns {LobbyGamesLaunchOldPage | LobbyGamesLaunchNewPage}
 */
export function getLobbyPage(page, partnerId) {
  const lobbyNew = partnerId ? PARTNERS[partnerId]?.lobbyNew === true : false;
  return lobbyNew ? new LobbyGamesLaunchNewPage(page) : new LobbyGamesLaunchOldPage(page);
}

export default getLobbyPage;
