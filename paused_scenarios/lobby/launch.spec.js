// Lobby game-launch tests.
//
//   LOBBY [01] game launch available -> restores the saved session for the
//                current project's device and verifies the launch flow:
//                  · old lobby : open the casino lobby once, then for every
//                                provider in tests/data/lobbyData.js filter the
//                                provider, verify its games are listed and launch
//                                the first game.
//                  · new lobby : open the launcher and assert its UI opens (an
//                                in-container provider error still counts as pass).
//
// The lobby is opened ONCE per run and shared by all provider tests (serial
// mode). A provider that fails to launch does NOT fail its own test; instead the
// incident is collected and the final summary test fails with the full list, so
// every provider is reported even when one breaks.
//
// Uses the authenticated state captured by the auth setup project, per DEVICE
// (project.metadata.authDevice), so desktop and mobile each reuse their own
// session — no login is performed here.

import { test, expect } from '../../src/fixtures/base.js';
import { getLobbyPage } from '../../src/factories/lobbyRegistry.js';
import { getRuntimeConfig } from '../../src/config/index.js';
import { storageStatePath } from '../../src/config/storageState.js';
import { buildLobbyData } from '../../tests/data/lobbyData.js';

const { envName, partnerId, partner, baseURL } = getRuntimeConfig();
const lobbyData = buildLobbyData(partnerId);
const providerEntries = Object.entries(lobbyData.providers);

/** @param {unknown} err */
function firstLine(err) {
  return String(err instanceof Error ? err.message : err).split('\n')[0];
}

test.describe('LOBBY [01]: game launch availability', () => {
  // Providers share one lobby/page, so they must run in declaration order.
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('../../src/pages/lobby/LobbyGamesLaunchOldPage.js').LobbyGamesLaunchOldPage | import('../../src/pages/lobby/LobbyGamesLaunchNewPage.js').LobbyGamesLaunchNewPage} */
  let lobby;
  /** @type {{provider: string, error: string}[]} */
  const incidents = [];

  test.beforeAll(async ({ browser }, testInfo) => {
    const device = testInfo.project.metadata.authDevice ?? 'desktop';
    context = await browser.newContext({
      storageState: storageStatePath(envName, partnerId, device),
    });
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    lobby = getLobbyPage(page, partnerId);
    await lobby.open();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  if (providerEntries.length) {
    for (const [providerName, provider] of providerEntries) {
      test(
        `LOBBY [01] game launch available · ${partner.displayName} · ${providerName}`,
        { tag: ['@positive', '@smoke'] },
        async () => {
          try {
            await lobby.launchProviderGame(providerName, provider);
          } catch (err) {
            incidents.push({ provider: providerName, error: firstLine(err) });
            await lobby.recoverLobby();
          }
        },
      );
    }
  } else {
    test(
      `LOBBY [01] game launch available · ${partner.displayName}`,
      { tag: ['@positive', '@smoke'] },
      async () => {
        await lobby.launchGame(lobbyData);
      },
    );
  }

  test(`LOBBY [01] provider launch summary · ${partner.displayName}`, { tag: ['@positive', '@smoke'] }, async ({}, testInfo) => {
    await testInfo.attach('lobby-provider-incidents.json', {
      body: JSON.stringify(incidents, null, 2),
      contentType: 'application/json',
    });
    expect(
      incidents.map((i) => `${i.provider}: ${i.error}`),
      `Provider launch incidents:\n${incidents.map((i) => `· ${i.provider}: ${i.error}`).join('\n') || '(none)'}`,
    ).toEqual([]);
  });
});