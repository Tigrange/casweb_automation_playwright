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
 * @param {'desktop'|'mobile'} [device] defaults to 'desktop'. Mobile can use a
 *   separate account via <PREFIX>_<ENV>_USERNAME_MOBILE / _PASSWORD_MOBILE
 *   (needed when the platform enforces a single session per account); when those
 *   are not set it falls back to the shared credentials.
 * @returns {{ envName: string, partnerId: string, partner: object, device: string, baseURL: string, creds: {username: string, password: string} }}
 * @throws when the partner is unknown, the requested environment is not
 *   configured for that partner, or its credentials are missing.
 */
export function getRuntimeConfig(partnerId = process.env.PARTNER || 'totogaming', envName = process.env.PLAYWRIGHT_ENV || 'prod', device = 'desktop') {
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

  // Devices may log in with separate accounts (single-session platforms). A
  // mobile-specific <PREFIX>_<ENV>_USERNAME_MOBILE / _PASSWORD_MOBILE wins when
  // present; otherwise both devices share the standard account.
  const deviceSpecific = device === 'mobile';
  const username =
    (deviceSpecific && process.env[`${prefix}_${upperEnv}_USERNAME_MOBILE`]) ||
    process.env[`${prefix}_${upperEnv}_USERNAME`];
  const password =
    (deviceSpecific && process.env[`${prefix}_${upperEnv}_PASSWORD_MOBILE`]) ||
    process.env[`${prefix}_${upperEnv}_PASSWORD`];

  if (!username || !password) {
    const mobileHint = deviceSpecific
      ? ` (or ${prefix}_${upperEnv}_USERNAME_MOBILE / _PASSWORD_MOBILE for the mobile account)`
      : '';
    throw new Error(
      `Missing credentials for ${partner.id} [${envName}]. ` +
        `Set ${prefix}_${upperEnv}_USERNAME and ${prefix}_${upperEnv}_PASSWORD${mobileHint} in .env`,
    );
  }

  return { envName, partnerId, partner, device, baseURL: env.baseURL, creds: { username, password } };
}

export { PARTNERS, listPartners } from './partners.js';