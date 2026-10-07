// Central runtime configuration. Resolves the target partner + environment
// and surfaces resolved credentials. Use this everywhere instead of reaching
// into process.env directly.

import { loadEnv } from './env.js';
import { PARTNERS, listPartners } from './partners.js';

/**
 * Resolve the concrete runtime config for a partner/environment.
 *
 * @param {string} [partnerId] defaults to process.env.PARTNER || 'totogaming'
 * @param {string} [envName]   defaults to process.env.PLAYWRIGHT_ENV || 'prod'
 * @returns {{ envName: string, partnerId: string, partner: object, baseURL: string, creds: {username: string, password: string} }}
 * @throws when the partner is unknown, the requested environment is not
 *   configured for that partner, or its credentials are missing.
 */
export function getRuntimeConfig(partnerId = process.env.PARTNER || 'totogaming', envName = process.env.PLAYWRIGHT_ENV || 'prod') {
  loadEnv(envName);

  const partner = PARTNERS[partnerId];
  if (!partner) {
    throw new Error(`Unknown partner "${partnerId}". Registered partners: ${listPartners().join(', ')}`);
  }

  // NEVER fall back to another environment. A run explicitly asking for `test`
  // must not silently execute against `prod` (or vice versa); if the requested
  // environment is not configured for this partner, fail loudly.
  const env = partner.envs[envName];
  if (!env) {
    const available = Object.keys(partner.envs);
    throw new Error(
      `Environment "${envName}" is not configured for partner "${partnerId}". ` +
        `Configured environment(s): ${available.length ? available.join(', ') : '(none)'}. ` +
        `Set PLAYWRIGHT_ENV to one of them.`,
    );
  }

  const prefix = env.credsEnvPrefix;
  const upperEnv = envName.toUpperCase();
  const username = process.env[`${prefix}_${upperEnv}_USERNAME`];
  const password = process.env[`${prefix}_${upperEnv}_PASSWORD`];

  if (!username || !password) {
    throw new Error(
      `Missing credentials for ${partner.id} [${envName}]. ` +
        `Set ${prefix}_${upperEnv}_USERNAME and ${prefix}_${upperEnv}_PASSWORD in .env`,
    );
  }

  return { envName, partnerId, partner, baseURL: env.baseURL, creds: { username, password } };
}

export { PARTNERS, listPartners } from './partners.js';