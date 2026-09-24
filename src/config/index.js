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

  const env = partner.envs[envName];
  if (!env) {
    throw new Error(`Partner "${partnerId}" has no environment "${envName}". Available: ${Object.keys(partner.envs).join(', ')}`);
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

/**
 * Convenience accessor mirroring the process-level defaults.
 * Prefer passing explicit args when iterating over multiple partners.
 */
export function getRuntimeDefaults() {
  return getRuntimeConfig();
}