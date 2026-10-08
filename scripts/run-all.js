// scripts/run-all.js
//
// Full-suite orchestrator. It runs the feature runners from scripts/features.js
// (the SUITE order) in sequence — no duplicated runner logic and NO Playwright
// project dependency between the suites. Registration goes first because it is
// independent of authentication; Login then performs its auth-desktop/auth-mobile
// flow. Adding a feature to the suite = adding its id to SUITE in features.js.
// A feature with `enabled: false` in features.js is skipped by the suite (but can
// still be run on its own via scripts/run-feature.js).
//
// FAILURE POLICY (fail-fast, documented in README): if a feature fails, the
// remaining features are NOT started and the process exits non-zero. This is
// purely an orchestration decision; it does not change test dependencies. If a
// feature passes, the next one runs and the final exit code is the process's.
//
// Artifacts stay isolated per feature (see scripts/lib/artifacts.js), so runners
// never touch each other's blobs/reports.
//
// Usage:
//   node scripts/run-all.js                     -> all partners, suite order
//   node scripts/run-all.js totogaming          -> one partner (forwarded)
//   node scripts/run-all.js totogaming --type=all
//   PW_ARTIFACTS_DIR=C:\pw-artifacts node scripts/run-all.js
//
// Any arguments are forwarded to EVERY feature runner. Feature-specific flags
// (e.g. --projects) should be passed to the individual runner instead.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suiteFeatures, disabledSuiteFeatures } from './features.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const forward = process.argv.slice(2);

/** Run one feature via the generic runner (child process); return exit code. */
function runFeature(featureId) {
  console.log(`\n################ ${featureId.toUpperCase()} ################\n`);
  const { status } = spawnSync(
    process.execPath,
    [path.join(__dirname, 'run-feature.js'), featureId, ...forward],
    { stdio: 'inherit', env: process.env },
  );
  return status ?? 1;
}

// Suite = SUITE order (features.js) minus any feature with `enabled: false`.
const suite = suiteFeatures().map(({ id }) => id);
const disabled = disabledSuiteFeatures();

if (!suite.length) {
  console.error('No features enabled in the suite. Check `enabled` in scripts/features.js.');
  process.exit(1);
}

console.log(
  `Full suite: ${suite.map((id) => id.toUpperCase()).join(' -> ')}` +
    (disabled.length ? `  (skipping disabled: ${disabled.join(', ')})` : ''),
);

for (let i = 0; i < suite.length; i += 1) {
  const featureId = suite[i];
  const status = runFeature(featureId);

  if (status !== 0) {
    const remaining = suite.slice(i + 1);
    if (remaining.length) {
      console.error(
        `\n${featureId.toUpperCase()} failed (exit ${status}); ` +
          `skipping ${remaining.map((id) => id.toUpperCase()).join(', ')} (fail-fast).`,
      );
    }
    process.exit(status);
  }
}

process.exit(0);
