// Loads .env / .env.<env> files into process.env without a dependency.
// Precedence: an already-set env var > .env.<env> > .env > nothing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Parse a simple KEY=VALUE env file and populate process.env.
 * Never overrides variables that are already set (e.g. injected by CI).
 * @param {string} filePath
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Load environment files for the given env name.
 * @param {string} envName default 'test'
 */
export function loadEnv(envName = 'test') {
  parseEnvFile(path.join(ROOT, '.env'));
  parseEnvFile(path.join(ROOT, `.env.${envName}`));
  return envName;
}