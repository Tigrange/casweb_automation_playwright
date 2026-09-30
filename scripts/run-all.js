// scripts/run-all.js
//
// Full-suite orchestrator: REGISTER -> LOGIN.
//
// It simply runs the existing feature runners in sequence — no duplicated
// runner logic and NO Playwright project dependency between the suites.
// Registration goes first because it is independent of authentication; Login
// then performs its auth-desktop/auth-mobile flow.
//
// FAILURE POLICY (fail-fast, documented in README): if REGISTER fails, LOGIN is
// NOT started and the process exits non-zero. This is purely an orchestration
// decision; it does not change Register/Login test dependencies. If REGISTER
// passes, LOGIN runs and its exit code becomes the process exit code.
//
// Artifacts stay isolated per feature (see scripts/lib/artifacts.js), so the two
// runners never touch each other's blobs/reports.
//
// Usage:
//   node scripts/run-all.js                     -> all partners, register then login
//   node scripts/run-all.js totogaming          -> one partner (forwarded to both)
//   node scripts/run-all.js totogaming --type=all
//   PW_ARTIFACTS_DIR=C:\pw-artifacts node scripts/run-all.js
//
// Any arguments are forwarded to BOTH runners. Feature-specific flags (e.g.
// --projects) should be passed to the individual runners instead.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const forward = process.argv.slice(2);

/** Run one feature runner (child process) and return its exit code. */
function runRunner(script, label) {
  console.log(`\n################ ${label} ################\n`);
  const { status } = spawnSync(process.execPath, [path.join(__dirname, script), ...forward], {
    stdio: 'inherit',
    env: process.env,
  });
  return status ?? 1;
}

console.log('Full suite: REGISTER -> LOGIN');

const registerStatus = runRunner('run-register-all-partners.js', 'REGISTER');
if (registerStatus !== 0) {
  console.error(`\nREGISTER failed (exit ${registerStatus}); skipping LOGIN (fail-fast).`);
  process.exit(registerStatus);
}

const loginStatus = runRunner('run-login-all-partners.js', 'LOGIN');
process.exit(loginStatus);