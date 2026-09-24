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
 */

/** @type {Record<string, Partner>} */
export const PARTNERS = {
  totogaming: {
    id: 'totogaming',
    displayName: 'TotoGaming',
    envs: {
      test: {
        baseURL: 'https://totogaming.tst-digi.com/',
        credsEnvPrefix: 'TOTOGAMING',
      },
      prod: {
        baseURL: 'https://totogaming.am/',
        credsEnvPrefix: 'TOTOGAMING',
      },
    },
    features: { casino: true, betting: true, inbox: true },
  },
  totoro: {
    id: 'totoro',
    displayName: 'totoro',
    envs: {
      test: {
        baseURL: 'https://totoro.tst-digi.com/',
        credsEnvPrefix: 'TOTOGAMINGRO',
      },
      prod: {
        baseURL: 'https://totogaming.ro/en',
        credsEnvPrefix: 'TOTOGAMINGRO',
      },
    },
    features: { casino: true, betting: true, inbox: true },
  },
};

/** @returns {string[]} all registered partner ids */
export function listPartners() {
  return Object.keys(PARTNERS);
}