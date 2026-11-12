// LOBBY game-launch — WIDGET ("new") lobby design (design 2).
//
// Runs only for partners whose lobby is the widget lobby
// (partner.lobbyNew === true). Partners on the legacy lobby are covered by
// launch.old.spec.js, which is skipped for them — so each partner runs exactly
// ONE lobby scenario regardless of design.
//
// Flow per provider (currently one game per partner):
//   open widget lobby -> open filter -> Providers tab -> pick provider ->
//   apply -> launch the configured game -> assert the game iframe opened and
//   no verification gate blocked it.
//
// The authenticated storage state comes from the auth setup project, resolved
// per device exactly like the change-password / inbox specs (never logs in).

import { test, expect } from '#src/fixtures/base.js';
import { getRuntimeConfig } from '#src/config/index.js';
import { storageStatePath } from '#src/config/storageState.js';
import { buildLobbyData } from '#data/lobbyData.js';
import { LobbyGamesLaunchNewPage } from '#src/pages/lobby/LobbyGamesLaunchNewPage.js';
import { ensureEnvPlayerSession } from '#support/envPlayerAuth.js';

const { envName, partnerId, partner } = getRuntimeConfig();
const lobbyData = buildLobbyData(partnerId, envName);
const usesNewLobby = partner.lobbyNew === true;
// Env-player login (see launch.old.spec.js). LOBBY_USE_ENV_PLAYER=0 falls back
// to the auth-setup storage state.
const useEnvPlayer = process.env.LOBBY_USE_ENV_PLAYER !== '0';

let sessionPromise;
// One passing RGS provider is enough; remaining RGS providers are skipped.
let rgsCovered = false;

test.use({
  // Login inside the storageState fixture so the file exists before the test
  // context is created (works for prod where no pre-seeded file exists).
  storageState: async ({ browser }, use, testInfo) => {
    const device = testInfo.project.metadata.authDevice ?? 'desktop';
    const path = storageStatePath(envName, partnerId, device, useEnvPlayer ? 'envplayer' : undefined);
    if (useEnvPlayer) {
      sessionPromise ??= ensureEnvPlayerSession({ browser, partnerId, envName, device });
      await sessionPromise;
    }
    await use(path);
  },
});

test.describe('LOBBY [01] widget design: provider game launch', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  if (!usesNewLobby) return;

  for (const provider of lobbyData.providers) {
    const kind = provider.kind || 'direct';
    test(
      `LOBBY [01] widget: launch ${provider.name} · ${partner.displayName}`,
      { tag: ['@positive', '@smoke'] },
      async ({ runtime, page }) => {
        if (kind === 'rgs' && rgsCovered) {
          test.skip(true, 'RGS coverage already satisfied by an earlier provider');
        }

        const lobby = new LobbyGamesLaunchNewPage(page);
        await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
        await lobby.open(lobbyData);

        // Provider not enabled on this partner -> skip and continue with the next.
        if (!(await lobby.isProviderAvailable(provider))) {
          test.skip(true, `Provider "${provider.name}" (${provider.filter}) is not available`);
        }

        await lobby.selectProvider(provider);
        // No pinned game -> the FIRST game from the filtered provider is launched.
        await lobby.launchGame(provider.game);

        if (kind === 'rgs') rgsCovered = true;
      },
    );
  }

  if (!lobbyData.providers.length) {
    test(
      `LOBBY [01] widget lobby opens · ${partner.displayName}`,
      { tag: ['@positive', '@smoke'] },
      async ({ runtime, page }) => {
        const lobby = new LobbyGamesLaunchNewPage(page);
        await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
        await lobby.open(lobbyData);
      },
    );
  }

  // Quick way to cover EVERY provider without hardcoding: discover the provider
  // items from the widget filter and launch the first game for each. Covers
  // direct (Pragmatic/Amusnet) and RGS V5/V3 providers. Opt-in: LOBBY_SWEEP=1.
  test(
    `LOBBY [02] widget: all providers sweep · ${partner.displayName}`,
    { tag: ['@regression'] },
    async ({ runtime, page }, testInfo) => {
      test.skip(process.env.LOBBY_SWEEP !== '1', 'set LOBBY_SWEEP=1 to run the all-providers sweep');

      const lobby = new LobbyGamesLaunchNewPage(page);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });
      await lobby.open(lobbyData);

      const providers = await lobby.listProviders();
      const incidents = [];
      for (const provider of providers) {
        try {
          await lobby.selectProvider(provider);
          await lobby.launchGame();
        } catch (err) {
          incidents.push({ provider: provider.filter, error: String(err).split('\n')[0] });
          for (const popup of page.context().pages()) {
            if (popup !== page && !popup.isClosed()) await popup.close().catch(() => {});
          }
          await page
            .goto(new URL(lobbyData.lobbyUrl, runtime.baseURL).href, { waitUntil: 'domcontentloaded' })
            .catch(() => {});
        }
      }

      await testInfo.attach('lobby-sweep-incidents.json', {
        body: JSON.stringify(incidents, null, 2),
        contentType: 'application/json',
      });
      expect(
        incidents.map((i) => `${i.provider}: ${i.error}`),
        `Provider launch incidents:\n${incidents.map((i) => `· ${i.provider}: ${i.error}`).join('\n') || '(none)'}`,
      ).toEqual([]);
    },
  );
});
