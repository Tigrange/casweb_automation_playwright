// Lobby game-launch test data. `buildLobbyData(partnerId)` returns the launch
// parameters. Partner overrides take precedence over COMMON.
//
// `providers` is a map keyed by the provider name shown in the lobby filter.
// Each entry carries the `selector` used to pick that provider in the filter.

/** Values valid for all partners. */
const COMMON = {
  providers: {},
  maxGames: 1,
};

/** Partner-specific overrides. */
const BY_PARTNER = {
  totogaming: {
    providers: {
      pragmaticplay: { selector: '[data-url="pragmaticplay"]' }, // TODO verify
      egtdigital: { selector: '[data-url="egtdigital"]' }, // TODO verify
      amusnet: { selector: '[data-url="amusnet"]' }, // TODO verify
      oakss: { selector: '[data-url="oakss"]' }, // TODO verify
    },
  },
  // totoro: {
  //   providers: {
  //     netent: { selector: '[title="netent"]' },
  //     playngo: { selector: '[title="playngo"]' },
  //     pragmaticplay: { selector: '[title="pragmaticplay"]' },
  //   },
  // },
  // cozbet: {
  //   providers: {
  //     netent: { selector: '[title="netent"]' },
  //     playngo: { selector: '[title="playngo"]' },
  //     pragmaticplay: { selector: '[title="pragmaticplay"]' },
  //   },
  // },
  // betfa: {
  //   providers: {
  //     netent: { selector: '[title="netent"]' },
  //     playngo: { selector: '[title="playngo"]' },
  //     pragmaticplay: { selector: '[title="pragmaticplay"]' },
  //   },
  // },
};

/**
 * Build the lobby launch payload for the given partner.
 * @param {string} [partnerId]
 */
export function buildLobbyData(partnerId = 'totogaming') {
  return { ...COMMON, ...(BY_PARTNER[partnerId] || {}) };
}

export default buildLobbyData;