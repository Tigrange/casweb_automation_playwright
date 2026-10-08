// scripts/run-feature.js
//
// Generic "run a feature across all partners" runner. This replaces the former
// per-feature runner files (run-login-all-partners.js, run-register-...): the
// per-feature config now lives in scripts/features.js and ALL execution logic
// stays in scripts/lib/runAllPartners.js (unchanged).
//
// The only job here is: take the feature id off argv, look it up, and hand the
// remaining args + the feature options to runAllPartners().
//
// Usage:
//   node scripts/run-feature.js <feature> [partners...] [flags]
//
// Examples:
//   node scripts/run-feature.js login
//   node scripts/run-feature.js login totogaming --workers=2
//   node scripts/run-feature.js register --type=all
//   node scripts/run-feature.js cashier totoro --parallel=2
//
// All flags/partners after the feature id are forwarded untouched; for the full
// flag list see scripts/lib/runAllPartners.js.

import { FEATURES, listFeatures } from './features.js';
import { runAllPartners } from './lib/runAllPartners.js';

const [, , featureId, ...rest] = process.argv;

if (!featureId || featureId.startsWith('--')) {
  console.error(`Usage: node scripts/run-feature.js <feature> [partners...] [flags]`);
  console.error(`Features: ${listFeatures().join(', ')}`);
  process.exit(1);
}

const feature = FEATURES[featureId];
if (!feature) {
  console.error(`Unknown feature "${featureId}". Available: ${listFeatures().join(', ')}`);
  process.exit(1);
}

// Drop the feature id so runAllPartners() sees only its own flags/partners.
process.argv = [process.argv[0], process.argv[1], ...rest];

await runAllPartners(feature);
