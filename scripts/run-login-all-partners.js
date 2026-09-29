// run-login-all-partners.js
//
// WHAT THIS SCRIPT DOES
// ---------------------
// Runs the login spec (tests/auth/login.spec.js) once per registered partner
// (see src/config/partners.js) across every enabled browser/device project
// (see playwright.config.js), then prints a PASS/FAIL summary and exits
// non-zero if any combination failed.
//
// WHY A SCRIPT INSTEAD OF A package.json SCRIPT
// ---------------------------------------------
// A plain npm script such as:
//     "test:login:all": "cross-env PARTNER=x playwright test --project=e2e-chromium"
// can only target ONE hard-coded partner and ONE project. Playwright's PARTNER
// and --project are read once at startup, so covering N partners x M
// browsers/devices would require N*M near-identical npm scripts, and the
// results would be separate HTML reports with no combined summary.
//
// This script instead:
//   1. Reads the partner list from the single source of truth (partners.js), so
//      a new partner is picked up automatically with no script edits.
//   2. Validates the requested partners up front and fails fast on typos.
//   3. Spawns Playwright sequentially (one partner/project at a time) with the
//      correct PARTNER / PLAYWRIGHT_ENV env vars injected per run.
//   4. Writes a separate HTML report per partner+project (no overwriting) and
//      prints one consolidated PASS/FAIL summary at the end.
//   5. Forwards any args after `--` straight to Playwright (e.g. --headed).
//
// USAGE
// -----
//   node scripts/run-login-all-partners.js
//       -> every partner, every default browser/device project, prod env
//
//   node scripts/run-login-all-partners.js --env=test
//       -> every partner against the test environment
//
//   node scripts/run-login-all-partners.js totogaming betfa
//       -> only the named partners (validated against partners.js)
//
//   node scripts/run-login-all-partners.js --projects=e2e-chromium,e2e-firefox
//       -> only the named browser/device projects (see playwright.config.js)
//
//   node scripts/run-login-all-partners.js totogaming --projects=e2e-mobile-chromium -- --headed
//       -> one partner, one device project, extra flags forwarded to Playwright

import { spawnSync } from 'node:child_process';
import { listPartners } from '../src/config/partners.js';

// The login spec is shared by all partners; PARTNER selects which one to run.
const SPEC = 'tests/auth/login.spec.js';

// Default projects = cross-browser desktop (Chrome/Firefox/WebKit) + Android
// mobile Chromium. These mirror the enabled E2E projects in playwright.config.js.
// e2e-mobile-webkit (iPhone) is commented out there, so it is omitted here too.
const DEFAULT_PROJECTS = ['e2e-chromium',  'e2e-mobile-chromium', 'e2e-firefox', 'e2e-webkit'];

// Split our own args from Playwright args. Everything after `--` is passed
// through untouched (e.g. --headed, --grep, --debug).
const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const own = sep === -1 ? argv : argv.slice(0, sep);
const passThrough = sep === -1 ? [] : argv.slice(sep + 1);

// Parse our own flags; anything left over is treated as a partner id.
let envName = 'prod';
let projects = DEFAULT_PROJECTS;
const requested = [];
for (const arg of own) {
  if (arg.startsWith('--env=')) envName = arg.slice('--env='.length);
  else if (arg.startsWith('--projects=')) {
    projects = arg.slice('--projects='.length).split(',').map((p) => p.trim()).filter(Boolean);
  } else if (arg.startsWith('--project=')) {
    // Singular alias for convenience; replaces the default project list.
    projects = [arg.slice('--project='.length)];
  } else requested.push(arg);
}

// Validate partners against the registry so a typo fails fast with a helpful
// message instead of silently running nothing (or the wrong partner).
const all = listPartners();
const unknown = requested.filter((id) => !all.includes(id));
if (unknown.length) {
  console.error(`Unknown partner(s): ${unknown.join(', ')}. Available: ${all.join(', ')}`);
  process.exit(1);
}
const partners = requested.length ? requested : all;

if (!projects.length) {
  console.error('No projects selected. Use --projects=e2e-chromium,e2e-firefox,...');
  process.exit(1);
}

// Run each partner x project combination in its own Playwright process.
// Sequential (not parallel) so console output and reports stay readable and
// the same storage-state / report paths never collide between runs.
const results = [];
for (const partnerId of partners) {
  for (const project of projects) {
    console.log(`\n=== ${partnerId} [${envName}] [${project}] ===\n`);
    const { status } = spawnSync(
      'npx',
      ['playwright', 'test', SPEC, `--project=${project}`, ...passThrough],
      {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          PARTNER: partnerId,
          PLAYWRIGHT_ENV: envName,
          // Keep a distinct report folder per partner+project so runs don't
          // overwrite each other, and never auto-open a browser from the CLI.
          PLAYWRIGHT_HTML_OUTPUT_DIR: `playwright-report/${partnerId}/${project}`,
          PLAYWRIGHT_HTML_OPEN: 'never',
        },
      },
    );
    results.push({ partnerId, project, status: status ?? 1 });
  }
}

// Consolidated summary; exit 1 if any combination failed so CI can detect it.
console.log('\n=== Summary ===');
for (const { partnerId, project, status } of results) {
  const label = `${partnerId}/${project}`;
  console.log(`${label.padEnd(40)} ${status === 0 ? 'PASSED' : `FAILED (exit ${status})`}`);
}
process.exit(results.some((r) => r.status !== 0) ? 1 : 0);