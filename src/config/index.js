// Central runtime configuration. Resolves the target partner + environment
// (and, when present, the optional .env credentials). Use this everywhere
// instead of reaching into process.env directly.

import { loadEnv } from './env.js';
import { PARTNERS, listPartners } from './partners.js';
import { domainCandidates } from '../utils/domain.js';

/**
 * Resolve the concrete runtime config for a partner/environment.
 *
 * @param {string} [partnerId] defaults to process.env.PARTNER || 'totogaming'
 * @param {string} [envName]   defaults to process.env.PLAYWRIGHT_ENV || 'prod'
 * @param {'desktop'|'mobile'} [device] defaults to 'desktop'. Mobile can use a
 *   separate account via <PREFIX>_<ENV>_USERNAME_MOBILE / _PASSWORD_MOBILE;
 *   when those are not set it falls back to the shared credentials.
 * @returns {{ envName: string, partnerId: string, partner: object, device: string, baseURL: string, creds: {username: string, password: string}|null }}
 * @throws when the partner is unknown or the requested environment is not
 *   configured for that partner.
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

  // Credentials are OPTIONAL. The auth/e2e suites register fresh players via the
  // B2B Registration API (src/api/registerApi.js) and never log in with these
  // accounts; the .env accounts are reserved for future Betting tests, which
  // must validate creds themselves and fail loudly where they actually use them.
  // A mobile-specific <PREFIX>_<ENV>_USERNAME_MOBILE / _PASSWORD_MOBILE wins
  // when present; otherwise both devices share the standard account.
  const deviceSpecific = device === 'mobile';
  const username =
    (deviceSpecific && process.env[`${prefix}_${upperEnv}_USERNAME_MOBILE`]) ||
    process.env[`${prefix}_${upperEnv}_USERNAME`];
  const password =
    (deviceSpecific && process.env[`${prefix}_${upperEnv}_PASSWORD_MOBILE`]) ||
    process.env[`${prefix}_${upperEnv}_PASSWORD`];

  return {
    envName,
    partnerId,
    partner,
    device,
    baseURL: env.baseURL,
    creds: username && password ? { username, password } : null,
  };
}

/**
 * Resolve the runtime config AND make sure its baseURL points at a live domain.
 *
 * Some partners rotate their production domain by bumping a trailing number
 * (cozbet002.com -> cozbet003.com ...). For such a partner the configured
 * baseURL is only the STARTING point: each candidate is probed with a short
 * request and the first one that answers with status < 400 is used. A failing
 * redirect (403/404/…), DNS/connection error or timeout counts as failure and
 * the next numeric domain is tried (see src/utils/domain.js). Hosts without a
 * trailing number are returned untouched (no probing, no overhead).
 *
 * When every candidate fails the ORIGINAL baseURL is kept, so the normal flows
 * still fail loudly with their usual clear error instead of silently running
 * against a wrong site. Results are memoised per partner/environment/device.
 *
 * @param {string} [partnerId] see {@link getRuntimeConfig}
 * @param {string} [envName]   see {@link getRuntimeConfig}
 * @param {'desktop'|'mobile'} [device]
 * @returns {Promise<ReturnType<typeof getRuntimeConfig>>}
 */
export async function resolveRuntimeConfig(
  partnerId = process.env.PARTNER || 'totogaming',
  envName = process.env.PLAYWRIGHT_ENV || 'prod',
  device = 'desktop',
) {
  const cacheKey = `${partnerId}|${envName}|${device}`;
  if (resolvedCache.has(cacheKey)) return resolvedCache.get(cacheKey);

  const config = getRuntimeConfig(partnerId, envName, device);
  const candidates = domainCandidates(config.baseURL);

  // Fast path: non-rotating domain — nothing to probe.
  if (candidates.length === 1) {
    resolvedCache.set(cacheKey, config);
    return config;
  }

  const live = await probeFirstLive(candidates);
  const resolved = live
    ? { ...config, baseURL: live.url }
    : config;

  if (live && live.url !== config.baseURL) {
    console.log(
      `[domainResolver] ${new URL(config.baseURL).hostname} unreachable → ` +
        `using ${new URL(live.url).hostname}`,
    );
  } else if (!live) {
    console.warn(
      `[domainResolver] no live domain among ${candidates
        .map((u) => new URL(u).hostname)
        .join(', ')} — keeping ${new URL(config.baseURL).hostname}`,
    );
  }

  resolvedCache.set(cacheKey, resolved);
  return resolved;
}

/** Memoisation for {@link resolveRuntimeConfig} (one probe per run). */
const resolvedCache = new Map();

/** Chrome-ish UA so WAFs treat the probe like a normal browser request. */
const PROBE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Probe candidates in order and return the first LIVE one.
 *
 * A plain HTTP probe cannot be trusted for status alone: Cloudflare/WAF answers
 * 403/429 to non-browser clients even when the site is perfectly alive (verified
 * on Cozbet). So a candidate counts as DEAD only when the request itself fails
 * (DNS/connection/TLS/timeout), or the server answers 404/410 (gone) or 5xx.
 * Everything else — including 401/403/429 — proves the domain is alive.
 *
 * @param {string[]} candidates
 * @returns {Promise<{ url: string, status: number } | null>}
 */
async function probeFirstLive(candidates) {
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': PROBE_UA },
        signal: AbortSignal.timeout(10_000),
      });
      const status = response.status;
      const dead = status === 404 || status === 410 || status >= 500;
      if (!dead) return { url: response.url || url, status };
    } catch {
      // DNS/connection/timeout — treat as dead and try the next numeric domain.
    }
  }
  return null;
}

export { PARTNERS, listPartners } from './partners.js';