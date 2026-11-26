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
// Folder that holds the raw test artifacts (screenshots). The runner writes a
// "<results>.artifacts" sidecar file with the exact directory, so manual runs
// usually need no extra flag.
const attachDirArg = args.find((a) => a.startsWith('--attachments-dir='));
const attachmentsDirArg = attachDirArg ? attachDirArg.slice('--attachments-dir='.length) : null;

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
        const device = /mobile/i.test(test.projectName ?? '') ? 'mobile' : 'web';

        out.push({
          caseId: String(caseIdAnn.description).replace(/^C/i, ''),
          status,
          title,
          reason,
          device,
          attachments: (result.attachments ?? []).map((a) => ({
            name: a.name,
            contentType: a.contentType,
            file: a.path,
          })),
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

/** First line of a raw error, without the "Error:" prefix and stack noise. */
function shortError(raw) {
  return String(raw || '')
    .replace(/^Error:\s*/i, '')
    .split('\n')[0]
    .trim()
    .slice(0, 200);
}

/** Human-readable TestRail comment for a result. */
function commentFor(c) {
  const base = `Automation ${c.status.toUpperCase()} (${c.device})`;
  if (c.status === 'passed') return base;

  const raw = c.reason || '';
  if (c.status === 'skipped') return `${base}: ${shortError(raw) || 'skipped'}`;

  // failed:
  if (/No storage state found/i.test(raw)) {
    return `${base}: login session missing — the login setup did not run or failed for this partner/device`;
  }
  if (/Login rejected/i.test(raw)) {
    return `${base}: site rejected the login — ${shortError(raw)}`;
  }
  if (/Cloudflare/i.test(raw)) {
    return `${base}: Cloudflare blocked the site — needs allowlisting`;
  }
  if (/timed out|Timeout .*exceeded/i.test(raw)) {
    return `${base}: test timed out`;
  }
  return `${base}: ${shortError(raw) || 'see the Playwright report'}`;
}

const results = cases.map((c) => ({
  case_id: Number(c.caseId),
  status_id: STATUS[c.status] ?? STATUS.blocked,
  comment: commentFor(c),
}));

const posted = await api('POST', `add_results_for_cases/${run.id}`, { results });
console.log(
  `Uploaded ${posted?.length ?? results.length} result(s) to run #${run.id} ` +
    `(${cases.filter((c) => c.status === 'passed').length} passed, ` +
    `${cases.filter((c) => c.status === 'failed').length} failed, ` +
    `${cases.filter((c) => c.status === 'skipped').length} skipped).`,
);

// ---- Attachments for FAILED cases (screenshots) -------------------------
// Playwright stores attachment paths relative to its output dir; the runner
// writes a "<results>.artifacts" sidecar with that dir for zero-config runs.
function resolveAttachmentsDir() {
  if (attachmentsDirArg) return path.resolve(attachmentsDirArg);
  const sidecar = `${reportPath}.artifacts`;
  if (fs.existsSync(sidecar)) return path.resolve(fs.readFileSync(sidecar, 'utf8').trim());
  if (process.env.PW_ATTACHMENTS_DIR) return path.resolve(process.env.PW_ATTACHMENTS_DIR);
  return process.cwd();
}

async function uploadAttachment(resultId, filePath, fileName) {
  const form = new FormData();
  form.append('attachment', new Blob([fs.readFileSync(filePath)]), fileName);
  const res = await fetch(`${baseUrl}/index.php?/api/v2/add_attachment_to_result/${resultId}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upload failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => null);
}

// Map uploaded results back to their case id (response order is not guaranteed).
const resultIdByCase = new Map();
for (const p of posted ?? []) {
  const caseKey = p.case_id ?? p.caseId;
  if (caseKey != null && p.id != null) resultIdByCase.set(String(caseKey), p.id);
}

const attachBase = resolveAttachmentsDir();
let uploadedAttachments = 0;
for (let i = 0; i < cases.length; i += 1) {
  const c = cases[i];
  if (c.status !== 'failed') continue;
  const resultId = resultIdByCase.get(String(c.caseId)) ?? posted?.[i]?.id;
  if (!resultId) {
    console.warn(`[testrail] no result id for C${c.caseId} — attachment skipped`);
    continue;
  }

  // Prefer screenshots (png); skip traces/videos.
  const shots = (c.attachments ?? []).filter(
    (a) => a.file && (String(a.contentType || '').startsWith('image/') || /\.png$/i.test(a.name || '')),
  );
  for (const shot of shots.slice(0, 3)) {
    const filePath = path.isAbsolute(shot.file) ? shot.file : path.join(attachBase, shot.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[testrail] attachment not found for C${c.caseId}: ${filePath}`);
      continue;
    }
    try {
      const info = await uploadAttachment(resultId, filePath, shot.name || path.basename(filePath));
      uploadedAttachments += 1;
      console.log(
        `[testrail] attached ${shot.name || path.basename(filePath)} to C${c.caseId} ` +
          `(result ${resultId}, attachment ${info?.attachment_id ?? '?'})`,
      );
    } catch (err) {
      console.warn(`[testrail] C${c.caseId} attachment: ${err.message}`);
    }
  }
}
if (uploadedAttachments) console.log(`Attached ${uploadedAttachments} screenshot(s) to failed cases.`);

console.log(`Run URL: ${baseUrl}/index.php?/runs/view/${run.id}`);
