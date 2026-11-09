// Lobby game-launch test data.
//
// `buildLobbyData(partnerId)` returns the launch parameters for a partner:
//
//   lobbyUrl   path of the casino lobby (used by both designs)
//   providers  ordered list of providers to verify. Per partner we launch ONE
//              game: the first provider's `game`.
//
// Provider entry shape:
//   {
//     name:   display name used in test titles
//     filter: provider slug used by the lobby filter
//             · old lobby: <chip data-url="...">
//             · new lobby: <item data-unique-url="...">
//     game:   { id: <data-game-id>, name: <display name> }
//   }
//
// The game is selected by its stable `data-game-id`, not by position, because
// the lobby renders the same game in several sliders/grids.
//
// TotoGaming TST (verified 2026-11-05): the Pragmatic provider lists the
// "North Guardians" game with data-game-id="17661" in BOTH lobby designs.
// Other partners reuse the same provider/game as a starting point until their
// tst catalog is verified against a live session (see TODO markers).

/** Values valid for all partners until a partner override is provided. */
const COMMON = {
  lobbyUrl: '/lobby/slots/main',
  providers: [],
};

/** Partner-specific overrides. */
const BY_PARTNER = {
  totogaming: {
    // Legacy lobby design (lobbyNew: false).
    lobbyUrl: '/lobby/slots/main',
    providers: [
      {
        name: 'Pragmatic',
        filter: 'pragmatic',
        game: { id: '17661', name: 'North Guardians' },
      },
    ],
  },
  totoro: {
    // Legacy lobby design (lobbyNew: false). TODO verify provider/game on TST.
    lobbyUrl: '/lobby/slots/main',
    providers: [
      {
        name: 'Pragmatic',
        filter: 'pragmatic',
        game: { id: '17661', name: 'North Guardians' },
      },
    ],
  },
  betfa: {
    // Legacy lobby design (lobbyNew: false). TODO verify provider/game on TST.
    lobbyUrl: '/lobby/slots/main',
    providers: [
      {
        name: 'Pragmatic',
        filter: 'pragmatic',
        game: { id: '17661', name: 'North Guardians' },
      },
    ],
  },
  manoto: {
    // Legacy lobby design (lobbyNew: false). TODO verify provider/game on TST.
    lobbyUrl: '/lobby/slots/main',
    providers: [
      {
        name: 'Pragmatic',
        filter: 'pragmatic',
        game: { id: '17661', name: 'North Guardians' },
      },
    ],
  },
  cozbet: {
    // Widget ("new") lobby design (lobbyNew: true). TODO verify the widget
    // lobby URL, provider slug and game on TST.
    lobbyUrl: '/lobby/slots/main',
    providers: [
      {
        name: 'Pragmatic',
        filter: 'pragmatic',
        game: { id: '17661', name: 'North Guardians' },
      },
    ],
  },
};

/**
 * Build the lobby launch payload for the given partner.
 * @param {string} [partnerId]
 */
export function buildLobbyData(partnerId = 'totogaming') {
  return { ...COMMON, ...(BY_PARTNER[partnerId] || {}) };
}

export default buildLobbyData;
