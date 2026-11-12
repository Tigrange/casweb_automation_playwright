// Storage-state path helper. Authentication state is captured per partner,
// environment and DEVICE, because desktop and mobile serve different login
// DOM/flows and must not share one file:
//
//   tests/support/storageState/<env>-<partner>-desktop.json
//   tests/support/storageState/<env>-<partner>-mobile.json
//
// An optional `variant` suffix keeps a second session (e.g. the lobby env-player
// account) separate from the fresh-player auth-setup session:
//
//   tests/support/storageState/<env>-<partner>-desktop-envplayer.json
//
// Kept in one place so the auth setup projects and the session-check tests
// always agree on the file name.

import path from 'node:path';
import { existsSync } from 'node:fs';

const STORAGE_ROOT = path.resolve(process.cwd(), 'tests', 'support', 'storageState');

/**
 * @param {string} envName  e.g. 'prod'
 * @param {string} partnerId e.g. 'totogaming'
 * @param {'desktop'|'mobile'} device
 * @param {string} [variant] optional suffix, e.g. 'envplayer'
 * @returns {string} absolute path to the storage-state file
 */
export function storageStatePath(envName, partnerId, device, variant) {
  const suffix = variant ? `-${variant}` : '';
  return path.join(STORAGE_ROOT, `${envName}-${partnerId}-${device}${suffix}.json`);
}

/**
 * Like {@link storageStatePath}, but fails with an actionable message when the
 * session file is missing. Auth-dependent features reuse a session created once
 * by the `auth` feature, so a standalone run must create it first.
 *
 * @param {string} envName
 * @param {string} partnerId
 * @param {'desktop'|'mobile'} device
 * @returns {string} absolute path to an EXISTING storage-state file
 */
export function requireStorageStatePath(envName, partnerId, device) {
  const file = storageStatePath(envName, partnerId, device);
  if (!existsSync(file)) {
    throw new Error(
      `No storage state found (${path.basename(file)}). ` +
        `Run the auth setup first: node scripts/run-feature.js auth ${partnerId} --env=${envName}`,
    );
  }
  return file;
}

export default storageStatePath;