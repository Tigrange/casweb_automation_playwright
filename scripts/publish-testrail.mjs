#!/usr/bin/env node
// publish-testrail.mjs
//
// Upload Playwright results to TestRail.
//
// Reads a Playwright JSON report (produced with --reporter=json), picks the
// tests that carry a `testrail_case_id` annotation (attached at runtime per
// device — see tests/support/testrail.js), creates ONE new TestRail run and
// posts the per-case results.
//
// Usage:
//   node scripts/publish-testrail.mjs [results.json] [--run-name="..."]
//
// Credentials come from .env (gitignored) or the environment:
//   TESTRAIL_URL, TESTRAIL_USER, TESTRAIL_API_KEY,
//   TESTRAIL_PROJECT_ID, TESTRAIL_SUITE_ID
//
// Status mapping (TestRail has no "skipped"):
//   passed  -> 1 (Passed)
//   failed  -> 5 (Failed)
//   skipped -> 2 (Blocked)  — Cloudflare blocks / desktop-only cases, with the
//                             skip reason in the result comment.

import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../src/config/env.js';

loadEnv(process.env.PLAYWRIGHT_ENV || 'prod');

const STATUS = { passed: 1, failed: 5, blocked: 2 };

const args = process.argv.slice(2);
const runNameArg = args.find((a) => a.startsWith('--run-name='));
const runName = runNameArg ? runNameArg.slice('--run-name='.length) : null;
// Append to an existing/planned TestRail run instead of creating a new one.
const runIdArg = args.find((a) => a.startsWith('--testrail-run-id='));
const appendRunId = runIdArg ? Number(runIdArg.slice('--testrail-run-id='.length)) : null;
const resultsFile = args.find((a) => !a.startsWith('--')) || 'results.json';

const required = ['TESTRAIL_URL', 'TESTRAIL_USER', 'TESTRAIL_API_KEY', 'TESTRAIL_PROJECT_ID', 'TESTRAIL_SUITE_ID'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing TestRail settings: ${missing.join(', ')} (add them to .env)`);
  process.exit(1);
}

const baseUrl = process.env.TESTRAIL_URL.replace(/\/$/, '');
const auth = Buffer.from(`${process.env.TESTRAIL_USER}:${process.env.TESTRAIL_API_KEY}`).toString('base64');

async function api(method, endpoint, body) {
  const res = await fetch(`${baseUrl}/index.php?/api/v2/${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TestRail ${method} ${endpoint} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Walk Playwright JSON report and collect { caseId, status, title, reason }. */
function collectCases(report) {
  const out = [];
  const walkSuite = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const annotations = test.annotations ?? [];
        const caseIdAnn = annotations.find((a) => a.type === 'testrail_case_id');
        if (!caseIdAnn?.description) continue;

        const result = (test.results ?? [])[0] ?? {};
        // `test.status` is Playwright's expectation ("expected"/"unexpected");
        // the real outcome lives in the individual result.
        const rawStatus = result.status ?? test.status ?? 'skipped';
        const status =
          rawStatus === 'passed'
            ? 'passed'
            : rawStatus === 'skipped'
              ? 'skipped'
              : 'failed';
        const skipAnn = annotations.find((a) => a.type === 'skip');
        const reason = skipAnn?.description || (result.error?.message ?? '').split('\n')[0];
        const title = `${suite.title ? `${suite.title} › ` : ''}${spec.title}`;

        out.push({
          caseId: String(caseIdAnn.description).replace(/^C/i, ''),
          status,
          title,
          reason,
        });
      }
    }
    for (const child of suite.suites ?? []) walkSuite(child);
  };
  for (const suite of report.suites ?? []) walkSuite(suite);
  return out;
}

const reportPath = path.resolve(resultsFile);
if (!fs.existsSync(reportPath)) {
  console.error(`Results file not found: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const collected = collectCases(report);

if (!collected.length) {
  console.warn('No tests with a testrail_case_id annotation — nothing to upload.');
  process.exit(0);
}

// Validate the case IDs against the suite BEFORE touching any run: a typo or a
// deleted case must never block the upload of the valid results.
async function existingCaseIds() {
  const ids = new Set();
  let offset = 0;
  const limit = 250;
  for (;;) {
    const page = await api(
      'GET',
      `get_cases/${process.env.TESTRAIL_PROJECT_ID}&suite_id=${process.env.TESTRAIL_SUITE_ID}` +
        `&limit=${limit}&offset=${offset}`,
    );
    const batch = page?.cases ?? [];
    for (const c of batch) ids.add(String(c.id));
    if (page?.size < limit || batch.length < limit) break;
    offset += limit;
  }
  return ids;
}

const knownIds = await existingCaseIds();
const cases = collected.filter((c) => knownIds.has(String(c.caseId)));
for (const c of collected) {
  if (!knownIds.has(String(c.caseId))) {
    console.warn(
      `[testrail] case C${c.caseId} not found in suite ${process.env.TESTRAIL_SUITE_ID} — skipped (${c.title})`,
    );
  }
}
if (!cases.length) {
  console.error(
    `None of the annotated case IDs exist in TestRail suite ${process.env.TESTRAIL_SUITE_ID} — nothing uploaded.`,
  );
  process.exit(1);
}

let run;
if (appendRunId) {
  console.log(`Appending results to existing TestRail run #${appendRunId}...`);
  // Only cases that belong to that run can receive results. `get_run` does not
  // always expose case_ids, so read the run's tests (paginated) instead.
  const runCaseIds = new Set();
  let offset = 0;
  const limit = 250;
  for (;;) {
    const page = await api('GET', `get_tests/${appendRunId}&limit=${limit}&offset=${offset}`);
    const batch = page?.tests ?? [];
    for (const t of batch) runCaseIds.add(String(t.case_id));
    if (batch.length < limit) break;
    offset += limit;
  }

  for (const c of [...cases]) {
    if (!runCaseIds.has(String(c.caseId))) {
      console.warn(
        `[testrail] case C${c.caseId} is not part of run #${appendRunId} — skipped (${c.title})`,
      );
      cases.splice(cases.indexOf(c), 1);
    }
  }
  if (!cases.length) {
    console.error(`No result matches the cases of run #${appendRunId} — nothing uploaded.`);
    process.exit(1);
  }
  run = { id: appendRunId };
} else {
  const name = runName || `[automation] ${path.basename(resultsFile)} ${new Date().toISOString()}`;
  console.log(`Creating TestRail run "${name}" in project ${process.env.TESTRAIL_PROJECT_ID}...`);
  run = await api('POST', `add_run/${process.env.TESTRAIL_PROJECT_ID}`, {
    suite_id: Number(process.env.TESTRAIL_SUITE_ID),
    name,
    include_all: false,
    case_ids: cases.map((c) => Number(c.caseId)),
  });
}

const results = cases.map((c) => {
  const statusId = STATUS[c.status] ?? STATUS.blocked;
  const comment =
    c.status === 'passed'
      ? 'Automation: passed'
      : `Automation: ${c.status}${c.reason ? ` — ${c.reason}` : ''}`;
  return { case_id: Number(c.caseId), status_id: statusId, comment };
});

const posted = await api('POST', `add_results_for_cases/${run.id}`, { results });
console.log(
  `Uploaded ${posted?.length ?? results.length} result(s) to run #${run.id} ` +
    `(${cases.filter((c) => c.status === 'passed').length} passed, ` +
    `${cases.filter((c) => c.status === 'failed').length} failed, ` +
    `${cases.filter((c) => c.status === 'skipped').length} skipped).`,
);
console.log(`Run URL: ${baseUrl}/index.php?/runs/view/${run.id}`);
