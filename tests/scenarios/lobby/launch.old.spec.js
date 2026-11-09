// LOBBY game-launch — LEGACY lobby design (design 1).
//
// Runs only for partners whose lobby is the classic `#js_lobby_main_wrapper`
// page (partner.lobbyNew === false). Partners on the widget lobby are covered
// by launch.new.spec.js, which is skipped for them — so each partner runs
// exactly ONE lobby scenario regardless of design.
//
// Flow per provider (currently one game per partner):
//   open lobby -> select provider filter -> launch the configured game ->
//   assert the game iframe opened and no verification gate blocked it.
//
// The authenticated storage state comes from the auth setup project, resolved
// per device exactly like the change-password / inbox specs (never logs in).

import { test } from '#src/fixtures/base.js';
import { getRuntimeConfig } from '#src/config/index.js';
import { storageStatePath } from '#src/config/storageState.js';
import { buildLobbyData } from '#data/lobbyData.js';
import { LobbyGamesLaunchOldPage } from '#src/pages/lobby/LobbyGamesLaunchOldPage.js';

const { envName, partnerId, partner } = getRuntimeConfig();
const lobbyData = buildLobbyData(partnerId);
const usesNewLobby = partner.lobbyNew === true;

test.use({
  storageState: async ({}, use, testInfo) => {
    const device = testInfo.project.metadata.authDevice ?? 'desktop';
    await use(storageStatePath(envName, partnerId, device));
  },
});

test.describe('LOBBY [01] legacy design: provider game launch', () => {
  if (usesNewLobby) return;

  for (const provider of lobbyData.providers) {
    test(
      `LOBBY [01] legacy: launch ${provider.name} · ${partner.displayName}`,
      { tag: ['@positive', '@smoke'] },
      async ({ runtime, page }) => {
        const lobby = new LobbyGamesLaunchOldPage(page);
        await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });

        await lobby.open(lobbyData);
        await lobby.selectProvider(provider);
        await lobby.launchGame(provider.game);
      },
    );
  }

  if (!lobbyData.providers.length) {
    test(
      `LOBBY [01] legacy lobby opens · ${partner.displayName}`,
      { tag: ['@positive', '@smoke'] },
      async ({ runtime, page }) => {
        const lobby = new LobbyGamesLaunchOldPage(page);
        await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
        await lobby.open(lobbyData);
      },
    );
  }
});
