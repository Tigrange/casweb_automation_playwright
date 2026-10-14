// Partner registry. Each partner declares its environments and the set of
// features it supports. Credentials are resolved by <PREFIX>_<ENV>_USERNAME /
// _PASSWORD from process.env (see .env.example).

/**
 * @typedef {Object} PartnerEnv
 * @property {string} baseURL
 * @property {string} credsEnvPrefix uppercase prefix for credential env vars
 */

/**
 * @typedef {Object} Partner
 * @property {string} id           unique machine id, also used in storageState filenames
 * @property {string} displayName  human readable
 * @property {Record<string, PartnerEnv>} envs keyed by env name (test/prod/...)
 * @property {{casino?: boolean, betting?: boolean, inbox?: boolean}} features
 * @property {boolean} cashierNew  true = new cashier deposit view, false = old
 * @property {boolean} lobbyNew    true = new lobby game-launch view, false = old
 */

/** @type {Record<string, Partner>} */
export const PARTNERS = {
  totogaming: {
    centrivoId: 2,
    id: 'totogaming',
    displayName: 'TotoGaming',
    server: 'totogaming',
    envs: {
      test: {
        baseURL: 'https://totogaming.tst-digi.com/',
        credsEnvPrefix: 'TOTOGAMING',
      },
      // prod: {
      //   baseURL: 'https://totogaming.am/',
      //   credsEnvPrefix: 'TOTOGAMING',
      // },
    },
    features: { casino: true, betting: true, inbox: true },
    cashierNew: false,
    lobbyNew: false,
  },
  totoro: {
    centrivoId: 1210,
    id: 'totoro',
    displayName: 'totoro',
    sever: 'totoro',
    envs: {
      // test: {
      //   baseURL: 'https://totoro.tst-digi.com/',
      //   credsEnvPrefix: 'TOTOGAMINGRO',
      // },
      prod: {
        baseURL: 'https://totogaming.ro/en',
        credsEnvPrefix: 'TOTOGAMINGRO',
      },
    },
    features: { casino: true, betting: true, inbox: true },
    cashierNew: true,
    lobbyNew: false,
  },
  cozbet: {
    centrivoId: 116,
    id: 'cozbet',
    displayName: 'Cozbet',
    server: 'shared',
    envs: {
      test: {
        baseURL: 'https://cozbet.tst-digi.com/',
        credsEnvPrefix: 'COZBET_TEST',
      },
      // prod: {
      //   baseURL: 'https://cozbet002.com/en',
      //   credsEnvPrefix: 'COZBET_SHARED',
      // },
    },
    features: { casino: true, betting: true, inbox: true },
    cashierNew: false,
    lobbyNew: true,
  },
  betfa: {
    centrivoId: 1028,
    id: 'betfa',
    displayName: 'Betfa',
    server: 'albatross',
    envs: {
      prod: {
        baseURL: 'https://betfa.com/',
        credsEnvPrefix: 'BETFA',
      },
    },
    features: { casino: true, betting: true, inbox: true },
    cashierNew: false,
    lobbyNew: false,
  },
};

/** @returns {string[]} all registered partner ids */
export function listPartners() {
  return Object.keys(PARTNERS);
}