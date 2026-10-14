// Player-store path helper. Freshly registered players are captured per
// environment, partner and DEVICE, mirroring the storage-state naming so the
// two never drift:
//
//   tests/support/players/<env>-<partner>-<desktop|mobile>.json
//
// Kept in one place so the auth setup (which registers + logs in) and any
// future consumer always agree on the file name.

import path from 'node:path';

const PLAYERS_ROOT = path.resolve(process.cwd(), 'tests', 'support', 'players');

/**
 * @param {string} envName  e.g. 'test'
 * @param {string} partnerId e.g. 'totogaming'
 * @param {'desktop'|'mobile'} device
 * @returns {string} absolute path to the players file
 */
export function playerPath(envName, partnerId, device) {
  return path.join(PLAYERS_ROOT, `${envName}-${partnerId}-${device}.json`);
}

export default playerPath;
