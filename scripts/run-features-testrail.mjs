#!/usr/bin/env node
// run-features-testrail.mjs
//
// One command that, for every requested partner:
//   1. runs the `auth` feature (fresh login + storage state),
//   2. runs the requested features (default: login, inbox, changepassword),
//   3. publishes each feature's JSON results to TestRail (new run per
//      partner+feature).
//
// Usage:
//   node scripts/run-features-testrail.mjs [options] [partners...]
//
// Options:
//   --env=prod|test              target environment (default: prod)
//   --features=login,inbox,changepassword
//   --skip-auth                  do not run the auth feature first
//   --no-publish                 run tests only, do not upload to TestRail
//   --artifacts-dir=<path>       artifact root (default: env PW_ARTIFACTS_DIR,
//                                else <repo>/artifacts)
//   --continue-on-fail           keep going when a feature fails (default: on)
//
// Examples:
//   node scripts/run-features-testrail.mjs totogaming --env=prod
//   node scripts/run-features-testrail.mjs --features=login totogaming manoto --env=prod
//
// Results JSON (written by the runner next to each feature's artifacts):
//   <artifacts>/<feature>/<env>/results-<partner>-<unit>.json
// and published to TestRail with the run name:
//   [automation] <feature> · <partner> · <env>

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPartners } from '../src/config/partners.js';
import { FEATURES } from './features.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const argValue = (name, fallback) => {
  const found = argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const envName = argValue('env', process.env.PLAYWRIGHT_ENV || 'prod');
const features = argValue('features', 'login,inbox,changepassword')
  .split(',')
  .map((f) => f.trim())
  .filter(Boolean);
const skipAuth = argv.includes('--skip-auth');
const publish = !argv.includes('--no-publish');
const artifactsRoot = path.resolve(
  argValue('artifacts-dir', process.env.PW_ARTIFACTS_DIR || path.join(REPO, 'artifacts')),
);

const requested = argv.filter((a) => !a.startsWith('--'));
const all = listPartners();
const unknown = requested.filter((p) => !all.includes(p));
if (unknown.length) {
  console.error(`Unknown partner(s): ${unknown.join(', ')}. Available: ${all.join(', ')}`);
  process.exit(1);
}
const partners = requested.length ? requested : all;

const node = process.execPath;

/** Run a child node script with inherited stdio; return exit code. */
function run(args) {
  const res = spawnSync(node, args, {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env, PW_ARTIFACTS_DIR: artifactsRoot },
  });
  return res.status ?? 1;
}

const summary = [];

for (const partner of partners) {
  console.log(`\n================ ${partner} [${envName}] ================`);

  if (!skipAuth) {
    const code = run(['scripts/run-feature.js', 'auth', partner, `--env=${envName}`, '--workers=1', '--parallel=1']);
    summary.push({ partner, step: 'auth', code });
    if (code !== 0) {
      console.warn(
        `[${partner}] auth FAILED (exit ${code}) — login/inbox/changepassword will most likely fail ` +
          `(missing session). Continuing.`,
      );
    }

    // Publish the REAL login results (LOGIN [00] carries the TestRail login
    // case). The auth feature runs one unit per device, so each device's file is
    // published as its own run (that is fine: the case IDs differ per device).
    if (publish) {
      for (const unit of ['auth-desktop', 'auth-mobile']) {
        const file = path.join(artifactsRoot, 'auth', envName, `results-${partner}-${unit}.json`);
        if (!fs.existsSync(file)) {
          console.warn(`[${partner}:${unit}] no results file (${file}) — nothing to publish`);
          continue;
        }
        const unitDevice = unit.endsWith('mobile') ? 'mobile' : 'desktop';
        const pubCode = run([
          'scripts/publish-testrail.mjs',
          file,
          `--run-name=[automation] auth · ${partner} · ${envName} · ${unitDevice}`,
        ]);
        summary.push({ partner, step: `${unit}:publish`, code: pubCode });
      }
    }
  }

  for (const feature of features) {
    const code = run([
      'scripts/run-feature.js',
      feature,
      partner,
      `--env=${envName}`,
      '--workers=1',
      '--parallel=1',
    ]);
    summary.push({ partner, step: feature, code });

    if (!publish) continue;

    // The artifact folder is named after the feature LABEL (e.g. "change-password").
    const label = FEATURES[feature]?.label || feature;
    const resultsFile = path.join(artifactsRoot, label, envName, `results-${partner}-e2e.json`);
    if (!fs.existsSync(resultsFile)) {
      console.warn(`[${partner}:${feature}] no results file (${resultsFile}) — nothing to publish`);
      summary.push({ partner, step: `${feature}:publish`, code: 1, note: 'missing results' });
      continue;
    }
    const pubCode = run([
      'scripts/publish-testrail.mjs',
      resultsFile,
      `--run-name=[automation] ${feature} · ${partner} · ${envName}`,
    ]);
    summary.push({ partner, step: `${feature}:publish`, code: pubCode });
  }
}

console.log('\n================ SUMMARY ================');
for (const row of summary) {
  const ok = row.code === 0 ? 'OK  ' : 'FAIL';
  console.log(`${row.partner.padEnd(14)} ${row.step.padEnd(26)} ${ok}${row.note ? ` (${row.note})` : ''}`);
}
const failures = summary.filter((r) => r.code !== 0);
console.log(
  failures.length
    ? `\n${failures.length} step(s) failed (see above).`
    : '\nAll steps finished successfully.',
);
process.exit(failures.length ? 1 : 0);
