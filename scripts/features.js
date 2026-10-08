// scripts/features.js
//
// Single source of truth for the test features that can be run across partners.
// Adding a feature = adding ONE entry here; no new runner file is needed.
//
// Each entry is passed verbatim to runAllPartners() (scripts/lib/runAllPartners.js),
// so the accepted shape is exactly that function's options object:
//
//   spec            path to the feature's spec file
//   label           short feature name used in headers/summary/artifacts
//   phases          PHASE MODE units (auth-sequenced); omit for PROJECT MODE
//   defaultProjects PROJECT MODE projects (else runAllPartners' shared default)
//   noDeps          pass --no-deps (skip project deps), e.g. register
//   enabled         include this feature in the full suite (run-all.js).
//                   Defaults to true when omitted. Set `enabled: false` to skip
//                   the feature in the suite WITHOUT removing its config;
//                   `run-feature.js <feature>` still runs it explicitly.
//
// Run one with:   node scripts/run-feature.js <feature> [partners...] [flags]

// Shared PHASE MODE config for features that need an authenticated session.
//
// A partner account allows only ONE active session, so desktop and mobile run
// as two SEQUENTIAL phases (each a single Playwright process): the phase's auth
// project performs ONE real login and its browser projects reuse that session.
//   desktop: auth-desktop (1 login) -> e2e-chromium
//   mobile:  auth-mobile  (1 login) -> e2e-mobile-chromium
const AUTH_PHASES = [
  {
    name: 'desktop',
    auth: 'auth-desktop',
    projects: [
      'auth-desktop',
      'e2e-chromium',
      // 'e2e-firefox',
      // 'e2e-webkit'
    ],
  },
  {
    name: 'mobile',
    auth: 'auth-mobile',
    projects: [
      'auth-mobile',
      'e2e-mobile-chromium',
    ],
  },
];

/** Feature id → runAllPartners options. */
export const FEATURES = {
  login: {
    spec: 'tests/auth/login.spec.js',
    label: 'login',
    phases: AUTH_PHASES,
    enabled: true,
  },

  register: {
    spec: 'tests/auth/register.spec.js',
    label: 'register',
    defaultProjects: ['register-chromium', 'register-mobile-chromium'],
    noDeps: true,
    enabled: false, // TODO enable when register flow is verified end-to-end
  },

  // Deposit/cashier scaffolding. Available on demand; not part of the default
  // suite yet (see SUITE below) until the flow is verified end-to-end.
  cashier: {
    spec: 'tests/cashier/deposit.spec.js',
    label: 'cashier',
    phases: AUTH_PHASES,
    enabled: true,
  },
};

/**
 * Ordered feature ids run by the full-suite orchestrator (scripts/run-all.js).
 * Register first because it is independent of authentication; add a feature id
 * here to include it in the suite. Fail-fast: a failing feature stops the rest.
 *
 * A feature listed here is still SKIPPED when its `enabled` flag is false.
 */
export const SUITE = ['register', 'login','cashier'];

/**
 * The suite's features, in order, minus the disabled ones.
 * @returns {{ id: string, feature: object }[]}
 */
export function suiteFeatures() {
  return SUITE.map((id) => ({ id, feature: FEATURES[id] })).filter(
    ({ feature }) => feature && feature.enabled !== false,
  );
}

/** Ordered ids skipped in the suite because `enabled` is false. @returns {string[]} */
export function disabledSuiteFeatures() {
  return SUITE.filter((id) => FEATURES[id] && FEATURES[id].enabled === false);
}

/** @returns {string[]} all registered feature ids */
export function listFeatures() {
  return Object.keys(FEATURES);
}
