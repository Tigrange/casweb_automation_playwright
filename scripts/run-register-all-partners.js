// run-register-all-partners.js
//
// Runs the registration feature across every partner. Registration is
// COMPLETELY INDEPENDENT of authentication:
//   * it uses the dedicated `register-chromium` / `register-mobile-chromium`
//     projects, which have NO auth dependency and NO storageState;
//   * the runner also passes --no-deps as a safety net, so it can never trigger
//     auth-desktop / auth-mobile or any real login.
//
//   => 0 real logins, 0 auth projects, no Login storageState is written.
//
// Execution order: this runner is meant to run BEFORE the login runner when
// running the whole suite (REGISTER -> LOGIN). They are independent suites with
// no Playwright project dependency between them; the order is purely how the
// two commands are invoked.
//
// Shared logic lives in scripts/lib/runAllPartners.js; see it for all flags.
//
//   node scripts/run-register-all-partners.js
//       -> every partner, prod, POSITIVE tests only
//   node scripts/run-register-all-partners.js --type=all
//       -> positive + negative registration tests
//   node scripts/run-register-all-partners.js --tag=regression
//       -> only the @regression registration tests

import { runAllPartners } from './lib/runAllPartners.js';

await runAllPartners({
  spec: 'tests/auth/register.spec.js',
  label: 'register',
  defaultProjects: ['register-chromium', 'register-mobile-chromium'],
  noDeps: true,
});