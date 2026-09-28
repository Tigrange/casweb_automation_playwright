// Central runtime configuration. Resolves the target partner + environment
// and surfaces resolved credentials. Use this everywhere instead of reaching
// into process.env directly.

import { loadEnv } from './env.js';
import { PARTNERS, listPartners } from './partners.js';

/**
 * Resolve the concrete runtime config for a partner/environment.
 *
 * @param {string} [partnerId] defaults to process.env.PARTNER || 'totogaming'
 * @param {string} [envName]   defaults to process.env.PLAYWRIGHT_ENV || 'test'
 * @returns {{ envName: string, partnerId: string, partner: object, baseURL: string, creds: {username: string, password: string} }}
 */
export function getRuntimeConfig(partnerId = process.env.PARTNER || 'totogaming', envName = process.env.PLAYWRIGHT_ENV || 'test') {
  loadEnv(envName);

  const partner = PARTNERS[partnerId];
  if (!partner) {
    throw new Error(`Unknown partner "${partnerId}". Registered partners: ${listPartners().join(', ')}`);
  }

  // Fall back to the partner's first configured env when the requested one is
  // not defined (e.g. a partner that only ships `prod` while the default is
  // `test`). Keeps config discovery and runtime fixtures from crashing.
  let env = partner.envs[envName];
  let resolvedEnvName = envName;
  if (!env) {
    const available = Object.keys(partner.envs);
    if (available.length === 0) {
      throw new Error(`Partner "${partnerId}" has no environments configured.`);
    }
    resolvedEnvName = available[0];
    env = partner.envs[resolvedEnvName];
  }

  const prefix = env.credsEnvPrefix;
  const upperEnv = resolvedEnvName.toUpperCase();
  const username = process.env[`${prefix}_${upperEnv}_USERNAME`];
  const password = process.env[`${prefix}_${upperEnv}_PASSWORD`];

  if (!username || !password) {
    throw new Error(
      `Missing credentials for ${partner.id} [${envName}]. ` +
        `Set ${prefix}_${upperEnv}_USERNAME and ${prefix}_${upperEnv}_PASSWORD in .env`,
    );
  }

  return { envName: resolvedEnvName, partnerId, partner, baseURL: env.baseURL, creds: { username, password } };
}

export { PARTNERS, listPartners } from './partners.js';

/**
 * Convenience accessor mirroring the process-level defaults.
 * Prefer passing explicit args when iterating over multiple partners.
 */
export function getRuntimeDefaults() {
  return getRuntimeConfig();
}