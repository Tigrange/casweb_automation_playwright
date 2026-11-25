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
import { resolveRuntimeConfig } from '#src/config/index.js';
import { storageStatePath } from '#src/config/storageState.js';
import { buildLobbyData } from '#data/lobbyData.js';
import { LobbyGamesLaunchNewPage } from '#src/pages/lobby/LobbyGamesLaunchNewPage.js';
import { ensureEnvPlayerSession } from '#support/envPlayerAuth.js';
import { skipOnCloudflare } from '#support/cloudflareEvidence.js';
import { attachTestRailCaseId } from '#support/testrail.js';

const { envName, partnerId, partner } = await resolveRuntimeConfig();
const lobbyData = buildLobbyData(partnerId, envName);
const usesNewLobby = partner.lobbyNew === true;
// Env-player login (see launch.old.spec.js). LOBBY_USE_ENV_PLAYER=0 falls back
// to the auth-setup storage state.
const useEnvPlayer = process.env.LOBBY_USE_ENV_PLAYER !== '0';

// TestRail case IDs for LOBBY [01] (separate web/mobile cases). Fill when
// the TestRail cases exist; null = nothing is attached.
const TESTRAIL_LOBBY_PROVIDERS = { web: null, mobile: null };

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
      try {
        sessionPromise ??= ensureEnvPlayerSession({ browser, partnerId, envName, device });
        await sessionPromise;
      } catch (err) {
        await skipOnCloudflare(err, testInfo, { partnerId, envName });
      }
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
      async ({ runtime, page }, testInfo) => {
        attachTestRailCaseId(testInfo, TESTRAIL_LOBBY_PROVIDERS);
        // LOBBY [01] provider launch runs on desktop only: the mobile lobby
        // selectors are still unverified (TODO verify mobile); LOBBY [02] and
        // LOBBY [03] cover the mobile templates.
        test.skip(testInfo.project.metadata.authDevice === 'mobile', 'LOBBY [01] provider launch runs on desktop only');
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
});
