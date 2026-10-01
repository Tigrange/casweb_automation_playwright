// run-login-all-partners.js
//
// Runs the login feature across every partner. Login is kept separate from
// other features (e.g. registration), which have their own runner scripts.
//
// PHASES (why the login runner is special)
// ----------------------------------------
// A partner account allows only ONE active session, so desktop and mobile
// authentication must never overlap for the same partner. For each partner the
// runner runs two SEQUENTIAL phases, each as ONE Playwright process:
//
//   desktop: auth-desktop (1 real login) -> e2e-chromium + e2e-firefox + e2e-webkit
//   mobile:  auth-mobile  (1 real login) -> e2e-mobile-chromium
//
// => exactly 2 real logins per partner (never one per browser). Different
// partners run concurrently (default 2) since they use different accounts.
//
// Shared logic lives in scripts/lib/runAllPartners.js; see it for all flags.
//
//   node scripts/run-login-all-partners.js
//       -> every partner, both phases, prod, POSITIVE tests, --parallel=2
//   node scripts/run-login-all-partners.js totogaming
//       -> one partner
//   node scripts/run-login-all-partners.js --parallel=1
//       -> sequential partners (no partner-level concurrency)
//   node scripts/run-login-all-partners.js --type=all
//       -> positive + negative login tests

import { runAllPartners } from './lib/runAllPartners.js';

await runAllPartners({
  spec: 'tests/auth/login.spec.js',
  label: 'login',
  phases: [
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
        'e2e-mobile-chromium'
      ],
    },
  ],
});