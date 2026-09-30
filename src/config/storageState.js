// Storage-state path helper. Authentication state is captured per partner,
// environment and DEVICE, because desktop and mobile serve different login
// DOM/flows and must not share one file:
//
//   tests/support/storageState/<env>-<partner>-desktop.json
//   tests/support/storageState/<env>-<partner>-mobile.json
//
// Kept in one place so the auth setup projects and the session-check tests
// always agree on the file name.

import path from 'node:path';

const STORAGE_ROOT = path.resolve(process.cwd(), 'tests', 'support', 'storageState');

/**
 * @param {string} envName  e.g. 'prod'
 * @param {string} partnerId e.g. 'totogaming'
 * @param {'desktop'|'mobile'} device
 * @returns {string} absolute path to the storage-state file
 */
export function storageStatePath(envName, partnerId, device) {
  return path.join(STORAGE_ROOT, `${envName}-${partnerId}-${device}.json`);
}

export default storageStatePath;