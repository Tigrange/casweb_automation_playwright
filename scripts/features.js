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
//   noDeps          pass --no-deps (skip project deps), e.g. register,if auth is not needed
//   enabled         include this feature in the full suite (run-all.js).
//                   Defaults to true when omitted. Set `enabled: false` to skip
//                   the feature in the suite WITHOUT removing its config;
//                   `run-feature.js <feature>` still runs it explicitly.
//
// Run one with:   node scripts/run-feature.js <feature> [partners...] [flags]

// Shared E2E phase for features that need an authenticated session.
//
// Each run registers a FRESH player per device via the B2B Registration API
// (tests/support/authSetup.js), so desktop and mobile no longer share one
// account session. That removes the old single-session constraint, and the
// whole chain runs in ONE Playwright process per partner:
//   auth-desktop + auth-mobile register their own players (in parallel),
//   then e2e-chromium / e2e-mobile-chromium start as soon as their own auth
//   project finishes (project `dependencies` in playwright.config.js enforce
//   the ordering). Partners run concurrently via `--parallel`.
const E2E_PHASE = [
  {
    name: 'e2e',
    projects: [
      'auth-desktop',
      'auth-mobile',
      'e2e-chromium',
      'e2e-mobile-chromium',
      // 'e2e-firefox',
      // 'e2e-webkit',
    ],
  },
];

/** Feature id → runAllPartners options. */
export const FEATURES = {
  login: {
    spec: 'tests/scenarios/auth/login.spec.js',
    label: 'login',
    phases: E2E_PHASE,
    enabled: true,
  },
  register: {
    spec: 'tests/scenarios/auth/register.spec.js',
    label: 'register',
    defaultProjects: ['register-chromium', 'register-mobile-chromium'],
    noDeps: true,
    enabled: false, // TODO enable when register flow is verified end-to-end
  },
  // Deposit/cashier scaffolding. Available on demand; not part of the default
  // suite yet (see SUITE below) until the flow is verified end-to-end.
  cashier: {
    spec: 'tests/scenarios/cashier/deposit.spec.js',
    label: 'cashier',
    phases: E2E_PHASE,
    enabled: false,
    noDeps: true
  },
  // Lobby game-launch. Two scenario versions live side by side: legacy
  // (launch.old.spec.js) and widget (launch.new.spec.js). Each partner runs
  // only the scenario matching its `lobbyNew` design flag, so pointing at the
  // directory still yields exactly ONE lobby scenario per partner.
  // Enabled on demand; a verified player is required for the KYC gate.
  lobby: {
    spec: 'tests/scenarios/lobby',
    label: 'lobby',
    phases: E2E_PHASE,
    enabled: false,
    noDeps: true
  },
  changepassword: {
    spec: 'tests/scenarios/change_password/change_password.spec.js',
    label: 'change-password',
    phases: E2E_PHASE,
    enabled: true,
    noDeps: true
  },
  inbox: {
    spec: 'tests/scenarios/inbox/inbox.spec.js',
    label: 'inbox',
    phases: E2E_PHASE,
    enabled: true,
    noDeps: true
  },
  dummy: {
    spec: 'tests/scenarios/dummy_lobby_page/dummy_lobby_page.spec.js',
    label: 'dummy_tests',
    phases: E2E_PHASE,
    enabled: false,
    noDeps: true
  },
};

/**
 * Ordered feature ids run by the full-suite orchestrator (scripts/run-all.js).
 * Register first because it is independent of authentication; add a feature id
 * here to include it in the suite. Fail-fast: a failing feature stops the rest.
 *
 * A feature listed here is still SKIPPED when its `enabled` flag is false.
 */
export const SUITE = ['register', 'login','cashier', 'lobby', 'changepassword', 'dummy'];

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
