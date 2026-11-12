// Lobby game-launch test data.
//
// `buildLobbyData(partnerId, envName)` returns the launch parameters for a
// partner/environment:
//
//   lobbyUrl   path of the casino lobby (per environment)
//   providers  providers to test; for each one the FIRST game in the
//              provider-filtered result is launched (positive flow).
//
// Provider entry shape:
//   {
//     name:   display name used in test titles
//     filter: provider slug used by the lobby filter
//             · old lobby: <chip data-url="...">
//             · new lobby: <item data-unique-url="...">
//     kind:   'direct' | 'rgs'
//             direct = Pragmatic/Amusnet; rgs = routed through Digitain RGS.
//             Only ONE rgs provider needs to pass per run; the rest are skipped.
//     game?:  { id: <data-game-id>, name?: <display name> }
//             OPTIONAL debugging override. Normally omit it so the first game
//             in the provider's filtered result is used.
//   }
//
// Providers that are not available on the partner are skipped automatically.

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
      { name: 'Pragmatic', filter: 'pragmatic', kind: 'direct' },
      { name: 'Amusnet (EGT)', filter: 'amusnet', kind: 'direct' },
      { name: 'SpadeGaming (RGS)', filter: 'spadegaming', kind: 'rgs' },
    ],
    byEnv: {
      // Production lobby lives at /lobby/casino/main and uses `pragmaticplay`.
      prod: {
        lobbyUrl: '/lobby/casino/main',
        providers: [
          { name: 'Pragmatic', filter: 'pragmaticplay', kind: 'direct' },
          { name: 'Amusnet (EGT)', filter: 'amusnet', kind: 'direct' },
          { name: 'EGT Digital (RGS)', filter: 'egtdigital', kind: 'rgs' },
          { name: 'Galaxsys (RGS)', filter: 'galaxsys', kind: 'rgs' },
          { name: 'Oakss (RGS)', filter: 'oakss', kind: 'rgs' },
        ],
      },
    },
  },
  totoro: {
    // Legacy lobby design (lobbyNew: false). TODO verify provider on TST.
    providers: [{ name: 'Pragmatic', filter: 'pragmatic', kind: 'direct' }],
  },
  betfa: {
    // Legacy lobby design (lobbyNew: false). TODO verify provider on TST.
    providers: [{ name: 'Pragmatic', filter: 'pragmatic', kind: 'direct' }],
  },
  manoto: {
    // Legacy lobby design (lobbyNew: false). TODO verify provider on TST.
    providers: [{ name: 'Pragmatic', filter: 'pragmatic', kind: 'direct' }],
  },
  cozbet: {
    // Widget ("new") lobby design (lobbyNew: true). TODO verify the widget
    // lobby URL and provider slug on TST.
    providers: [{ name: 'Pragmatic', filter: 'pragmatic', kind: 'direct' }],
  },
};

/**
 * Build the lobby launch payload for the given partner + environment.
 * @param {string} [partnerId]
 * @param {string} [envName]
 */
export function buildLobbyData(partnerId = 'totogaming', envName = 'test') {
  const base = BY_PARTNER[partnerId] || {};
  const override = base.byEnv?.[envName] || {};
  const { byEnv, ...rest } = base;
  void byEnv;
  return { ...COMMON, ...rest, ...override };
}

export default buildLobbyData;
