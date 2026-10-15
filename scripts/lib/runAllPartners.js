// scripts/lib/runAllPartners.js
//
// Shared engine for the generic feature runner (scripts/run-feature.js). Feature
// config (spec/label/phases) lives in scripts/features.js.
//
// WHAT IT DOES
// ------------
// Runs a feature's spec across every requested partner (src/config/partners.js)
// and browser/device project (playwright.config.js), then prints a PASS/FAIL
// summary and exits non-zero if anything failed. Full artifacts are preserved
// and merged into ONE combined HTML report.
//
// TWO MODES
// ---------
//  1. PHASE MODE (used by the login runner and any auth-dependent feature). The
//     caller supplies `phases`. The login feature now uses a SINGLE combined
//     phase, so one Playwright process per partner runs the whole chain:
//       auth-desktop + auth-mobile + e2e-chromium + e2e-mobile-chromium
//     Each device registers its OWN fresh player (B2B Registration API), so the
//     old single-session constraint is gone and desktop/mobile run in parallel
//     inside that one process (project `dependencies` enforce auth-before-e2e).
//     Different partners run CONCURRENTLY (a pool of `--parallel`, default 2)
//     because they use different accounts.
//
//  2. PROJECT MODE (used by the register runner). No `phases` are supplied, so
//     each project runs in its own Playwright process per partner. Partners also
//     run CONCURRENTLY up to `--parallel` (register is auth-independent).
//
// ARTIFACTS & COMBINED REPORT
// ---------------------------
// Playwright's `html` reporter writes one fixed folder and `test-results` is
// emptied each run, so a naive loop overwrites reports/artifacts. Instead:
//   1. Each process uses the built-in `blob` reporter with its OWN dir
//      (<feature>/blob/<partner>/<unit>, where unit is a phase or project).
//      A blob zip embeds results, errors, stack traces and attachments.
//   2. Each process also gets its own `--output` dir
//      (<feature>/test-results/<partner>/<unit>) so raw artifacts do not collide.
//   3. All blob zips are copied flat and `playwright merge-reports --reporter=html`
//      produces ONE self-contained report (<feature>/report/).
//
// Paths are FEATURE-SCOPED via scripts/lib/artifacts.js, so each feature only
// cleans/writes its own tree and features never collide. The artifact root is
// <repo>/artifacts by default, or PW_ARTIFACTS_DIR when set (e.g. to move the
// large trees off OneDrive).
//
// TEST TYPE / TAGS
// ----------------
// Tests are tagged with plain strings (@positive/@negative/@smoke/@regression).
// playwright.config.js turns TEST_TYPE / TEST_TAG into the per-project grep.
// DEFAULT IS POSITIVE-ONLY; use --type=all to also run negative cases.
//
// SUPPORTED FLAGS
// ---------------
//   --env=<name>                target environment (default: prod)
//   --type=positive|negative|all   test type filter (default: positive)
//   --tag=smoke|regression      optional suite tag (intersects the type)
//   --parallel=<n>              partner concurrency, both modes (default: 2)
//   --workers=<n>               Playwright workers per process (default: config)
//   --projects=a,b,c            limit projects (mapped into phases in phase mode)
//   --project=<name>            singular alias for --projects
//   <partner-id ...>            limit to specific partners (validated)
//   -- <playwright args>        everything after `--` is forwarded untouched

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { listPartners } from '../../src/config/partners.js';
import { TEST_TYPES, TEST_TAGS } from '../../src/config/testFilters.js';
import { getArtifactPaths } from './artifacts.js';
import { createRequire } from 'node:module';

// Resolve the Playwright CLI and run it with node directly (no shell). Using a
// shell would split artifact paths that contain spaces (the repo path is
// "Cazweb Automation", and PW_ARTIFACTS_DIR may contain spaces too).
const require = createRequire(import.meta.url);
const PLAYWRIGHT_CLI = require.resolve('@playwright/test/cli');

/**
 * Best-effort recursive delete. Report/blob folders live under OneDrive, which
 * can briefly hold file handles; a failed cleanup must never crash the run (the
 * report is already built by then). Retries a few times, then warns.
 * @param {string} target
 */
function safeRemove(target) {
  try {
    rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (err) {
    console.warn(`Warning: could not remove "${target}": ${err.message}`);
  }
}

// Default projects for PROJECT MODE (register runner). Mirrors the enabled E2E
// projects in playwright.config.js; mobile-webkit is commented out there too.
const DEFAULT_PROJECTS = [
  'e2e-chromium',
  'e2e-mobile-chromium',
  'e2e-firefox',
  'e2e-webkit'
];

// Default partner concurrency. Deliberately conservative: the machine has
// limited free RAM and browser processes are memory-heavy.
const DEFAULT_PARALLEL = 2;

// Artifact paths are FEATURE-SCOPED (see scripts/lib/artifacts.js): each runner
// only cleans/writes its own feature tree, so Login and Register (and any future
// feature) never collide. The root is <repo>/artifacts by default, or
// PW_ARTIFACTS_DIR when set (e.g. to move artifacts off OneDrive).

/** Spawn the Playwright CLI, prefixing every output line with `[prefix]`. */
function spawnPrefixed(args, { env, prefix }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PLAYWRIGHT_CLI, ...args], { env });
    const pipe = (stream) => {
      let buffer = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) process.stdout.write(`${prefix} ${line}\n`);
      });
      stream.on('end', () => {
        if (buffer) process.stdout.write(`${prefix} ${buffer}\n`);
      });
    };
    pipe(child.stdout);
    pipe(child.stderr);
    child.on('error', (err) => {
      process.stdout.write(`${prefix} spawn error: ${err.message}\n`);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/**
 * Run `workerFn` for every item, at most `concurrency` at a time.
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} workerFn
 */
async function runPool(items, concurrency, workerFn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await workerFn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Run a feature across all requested partners.
 *
 * @param {{
 *   spec: string,
 *   label: string,
 *   phases?: { name: string, auth: string, projects: string[] }[],
 *   defaultProjects?: string[],
 *   noDeps?: boolean,
 * }} options
 *   spec            - path to the spec file to run
 *   label           - short feature name used in headers/summary
 *   phases          - when provided, run in PHASE MODE; otherwise PROJECT MODE
 *   defaultProjects - PROJECT MODE default projects (else the shared default)
 *   noDeps          - pass --no-deps (skip project dependencies), e.g. register
 */
export async function runAllPartners({ spec, label, phases, defaultProjects, noDeps }) {
  // Split our own args from Playwright args. Everything after `--` is passed
  // through untouched (e.g. --headed, --grep, --debug).
  const argv = process.argv.slice(2);
  const sep = argv.indexOf('--');
  const own = sep === -1 ? argv : argv.slice(0, sep);
  const passThrough = sep === -1 ? [] : argv.slice(sep + 1);

  // Parse our own flags; anything left over is treated as a partner id.
  let envName = 'prod';
  // REMINDER: default test type is POSITIVE-ONLY. Pass --type=all (or
  // TEST_TYPE=all) to also run the negative cases.
  let type = 'positive';
  let tag;
  let parallel = DEFAULT_PARALLEL;
  let workers; // undefined => keep playwright.config.js worker setting
  let projectsArg; // undefined => use defaults
  const requested = [];
  for (const arg of own) {
    if (arg.startsWith('--env=')) envName = arg.slice('--env='.length);
    else if (arg.startsWith('--type=')) type = arg.slice('--type='.length);
    else if (arg.startsWith('--tag=')) tag = arg.slice('--tag='.length);
    else if (arg.startsWith('--parallel=')) parallel = Number(arg.slice('--parallel='.length));
    else if (arg.startsWith('--workers=')) workers = Number(arg.slice('--workers='.length));
    else if (arg.startsWith('--projects=')) {
      projectsArg = arg.slice('--projects='.length).split(',').map((p) => p.trim()).filter(Boolean);
    } else if (arg.startsWith('--project=')) {
      projectsArg = [arg.slice('--project='.length)];
    } else requested.push(arg);
  }

  // Validate the type/tag up front (buildGrep enforces the same rules inside
  // playwright.config.js, but failing here is faster and clearer).
  if (!TEST_TYPES.includes(type)) {
    console.error(`Unknown --type "${type}". Expected one of: ${TEST_TYPES.join(', ')}`);
    process.exit(1);
  }
  if (tag && !TEST_TAGS.includes(tag)) {
    console.error(`Unknown --tag "${tag}". Expected one of: ${TEST_TAGS.join(', ')}`);
    process.exit(1);
  }
  if (!Number.isInteger(parallel) || parallel < 1) {
    console.error(`Unknown --parallel "${parallel}". Expected a positive integer.`);
    process.exit(1);
  }
  if (workers !== undefined && (!Number.isInteger(workers) || workers < 1)) {
    console.error(`Unknown --workers "${workers}". Expected a positive integer.`);
    process.exit(1);
  }

  // Validate partners against the registry so a typo fails fast.
  const all = listPartners();
  const unknown = requested.filter((id) => !all.includes(id));
  if (unknown.length) {
    console.error(`Unknown partner(s): ${unknown.join(', ')}. Available: ${all.join(', ')}`);
    process.exit(1);
  }
  const partners = requested.length ? requested : all;

  // Build the list of "units" to run per partner. In PHASE MODE a unit is a
  // phase (its projects run together in ONE Playwright process); in PROJECT
  // MODE a unit is a single project.
  let units;
  if (phases) {
    units = phases
      .map((phase) => {
        // Canonical order; optionally filtered by --projects. When the phase
        // declares its auth project(s), keep those too when any of the phase's
        // projects is selected, so we never run a session-check without its
        // login.
        let selected = phase.projects;
        if (projectsArg) {
          selected = phase.projects.filter((p) => projectsArg.includes(p));
          if (phase.auth && selected.length && !selected.includes(phase.auth)) {
            selected = phase.projects.filter((p) => selected.includes(p) || p === phase.auth);
          }
        }
        return { name: phase.name, projects: selected };
      })
      .filter((u) => u.projects.length);

    if (projectsArg) {
      const known = new Set(phases.flatMap((p) => p.projects));
      const ignored = projectsArg.filter((p) => !known.has(p));
      if (ignored.length) console.warn(`Ignoring project(s) not part of any phase: ${ignored.join(', ')}`);
    }
    if (!units.length) {
      console.error('No projects selected for any phase.');
      process.exit(1);
    }
  } else {
    const projects = projectsArg ?? defaultProjects ?? DEFAULT_PROJECTS;
    if (!projects.length) {
      console.error('No projects selected. Use --projects=e2e-chromium,e2e-firefox,...');
      process.exit(1);
    }
    units = projects.map((project) => ({ name: project, projects: [project] }));
  }

  // Feature-scoped artifact tree for THIS runner. Only this feature's dirs are
// cleaned below — never the whole artifact root — so concurrent/other features
// (e.g. register) are untouched.
  const paths = getArtifactPaths(label);
  safeRemove(paths.blob);
  safeRemove(paths.blobMerged);
  safeRemove(paths.report);
  safeRemove(paths.testResults);
  mkdirSync(paths.blobMerged, { recursive: true });

  const typeLabel = tag ? `${type}+${tag}` : type;
  const baseEnv = {
    ...process.env,
    PLAYWRIGHT_ENV: envName,
    TEST_TYPE: type,
    ...(tag ? { TEST_TAG: tag } : {}),
  };

  /** Run all units for ONE partner, in order. Returns run records. */
  async function runPartner(partnerId) {
    const records = [];
    for (const unit of units) {
      const projects = unit.projects;
      const blobDir = `${paths.blob}/${partnerId}/${unit.name}`;
      const artifactDir = `${paths.testResults}/${partnerId}/${unit.name}`;
      console.log(
        `\n=== ${label} | ${partnerId} [${envName}] | ${unit.name} | ${projects.join(', ')} [${typeLabel}] ===\n`,
      );

      const args = ['test', spec];
      for (const project of projects) args.push(`--project=${project}`);
      // Emit a mergeable blob (embeds errors, traces, screenshots, videos and
      // other attachments) into this unit's own dir; a per-unit dir is required
      // because the blob reporter wipes its output dir on each process start.
      args.push('--reporter=blob', `--output=${artifactDir}`, ...passThrough);
      if (workers !== undefined) args.push(`--workers=${workers}`);
      // Belt-and-suspenders: skip project dependencies so a feature that does
      // not need auth (register) never triggers an auth project.
      if (noDeps) args.push('--no-deps');

      const status = await spawnPrefixed(args, {
        env: { ...baseEnv, PARTNER: partnerId, PLAYWRIGHT_BLOB_OUTPUT_DIR: blobDir },
        prefix: `[${partnerId}:${unit.name}]`,
      });
      records.push({ partnerId, unit: unit.name, blobDir, status });

      // Safety: if a phase failed, do NOT continue this partner's remaining
      // phases. Avoids hammering an account whose auth just failed.
      if (status !== 0 && phases && units.length > 1) {
        console.warn(`\n[${partnerId}] ${unit.name} phase failed; skipping remaining phases for this partner.`);
        break;
      }
    }
    return records;
  }

  // Run partners, concurrently up to `parallel` in BOTH modes. Each partner is
  // an independent process (per-partner storage state/players), so partners
  // never interfere; browser-level parallelism within a process is governed by
  // `--workers`.
  const runs = [];
  const concurrency = parallel;
  await runPool(partners, concurrency, async (partnerId) => {
    const records = await runPartner(partnerId);
    runs.push(...records);
  });

  // Collect every run's blob into the flat scratch dir. merge-reports reads only
  // top-level *.zip files (non-recursive), and a process can emit more than one
  // zip with names like report-<project>-<hash>.zip, so copy EVERY *.zip out
  // under a unique (partner + unit + original name) prefix.
  let blobCount = 0;
  for (const { partnerId, unit, blobDir } of runs) {
    if (!existsSync(blobDir)) continue;
    for (const file of readdirSync(blobDir).filter((f) => f.endsWith('.zip'))) {
      copyFileSync(`${blobDir}/${file}`, `${paths.blobMerged}/${partnerId}__${unit}__${file}`);
      blobCount += 1;
    }
  }

  // Merge all blobs into ONE self-contained HTML report (index.html + data/ +
  // trace/). The scratch dir is disposable once the merge completes.
  let mergeStatus = 0;
  if (blobCount === 0) {
    console.warn('\nNo blob reports were produced; skipping combined report.');
    safeRemove(paths.blob);
    safeRemove(paths.blobMerged);
  } else {
    console.log(`\n=== Merging ${blobCount} run(s) into ${paths.report}/ ===\n`);
    const { status } = spawnSync(
      process.execPath,
      [PLAYWRIGHT_CLI, 'merge-reports', '--reporter=html', paths.blobMerged],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          PLAYWRIGHT_HTML_OUTPUT_DIR: paths.report,
          PLAYWRIGHT_HTML_TITLE: `Cazweb ${label} - all partners`,
          PLAYWRIGHT_HTML_OPEN: 'never',
        },
      },
    );
    mergeStatus = status ?? 1;
    safeRemove(paths.blobMerged);
  }

  // Consolidated summary; exit 1 if any unit failed or the merge failed.
  console.log(`\n=== ${label} Summary ===`);
  for (const { partnerId, unit, status } of runs) {
    const rowLabel = `${partnerId}/${unit}`;
    console.log(`${rowLabel.padEnd(40)} ${status === 0 ? 'PASSED' : `FAILED (exit ${status})`}`);
  }
  if (blobCount) {
    const reportState = mergeStatus === 0 ? 'CREATED' : `FAILED (exit ${mergeStatus})`;
    console.log(`\nCombined report: ${paths.report}/ (${reportState})`);
    console.log(`Raw blobs:       ${paths.blob}/<partner>/<unit>/`);
    console.log(`Raw artifacts:   ${paths.testResults}/<partner>/<unit>/`);
  }
  process.exit(runs.some((r) => r.status !== 0) || mergeStatus !== 0 ? 1 : 0);
}