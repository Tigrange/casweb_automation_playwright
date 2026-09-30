// scripts/lib/artifacts.js
//
// Feature-scoped artifact paths, shared by every "run across all partners"
// runner. Adding a new feature must NOT require copying artifact logic — just
// pass the feature name to getArtifactPaths().
//
// Layout (one isolated tree per feature, so features never touch each other's
// blobs/artifacts/reports):
//
//   <ARTIFACT_ROOT>/<feature>/blob/          per-run Playwright blob reports
//   <ARTIFACT_ROOT>/<feature>/test-results/  per-run raw artifacts (traces, ...)
//   <ARTIFACT_ROOT>/<feature>/blob-merged/   scratch dir for merge-reports
//   <ARTIFACT_ROOT>/<feature>/report/        combined HTML report
//
// ARTIFACT_ROOT:
//   * defaults to <repo>/artifacts (git-ignored, repository-local)
//   * can be moved OUTSIDE the repo (e.g. off OneDrive) with
//       PW_ARTIFACTS_DIR=C:\pw-artifacts
//     which yields C:\pw-artifacts\<feature>\...
//
// Only generated artifacts live here — never source or test files.

import path from 'node:path';

const DEFAULT_ROOT = path.join(process.cwd(), 'artifacts');

/** Absolute root under which every feature's artifacts live. */
export const ARTIFACT_ROOT = process.env.PW_ARTIFACTS_DIR
  ? path.resolve(process.env.PW_ARTIFACTS_DIR)
  : DEFAULT_ROOT;

/**
 * Return the isolated artifact paths for one feature.
 *
 * @param {string} feature feature name, e.g. 'login' or 'register'
 * @returns {{ root: string, blob: string, testResults: string, blobMerged: string, report: string }}
 */
export function getArtifactPaths(feature) {
  const root = path.join(ARTIFACT_ROOT, feature);
  return {
    root,
    blob: path.join(root, 'blob'),
    testResults: path.join(root, 'test-results'),
    blobMerged: path.join(root, 'blob-merged'),
    report: path.join(root, 'report'),
  };
}

export default getArtifactPaths;