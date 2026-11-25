// TestRail integration helpers (annotation-based case IDs).
//
// TestRail has SEPARATE case IDs for web (desktop) and mobile. One spec file
// serves both devices (Playwright projects), so the case ID cannot live in the
// static test title — it is resolved at RUNTIME from the active project and
// attached as a test annotation:
//
//   testInfo.annotations: { type: 'testrail_case_id', description: 'C27479' }
//
// A later TestRail upload step (JUnit/reporter, postponed) reads this
// annotation and maps the result to the right web/mobile case. Until the cases
// exist in TestRail, pass `null` and nothing is attached.

/**
 * 'web' for desktop projects, 'mobile' for mobile projects.
 * @param {import('@playwright/test').TestInfo} testInfo
 * @returns {'web'|'mobile'}
 */
export function deviceTag(testInfo) {
  const device = testInfo.project.metadata.authDevice ?? 'desktop';
  return device === 'mobile' ? 'mobile' : 'web';
}

/**
 * Attach the TestRail case ID for the current device when one is configured.
 *
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{ web?: string|null, mobile?: string|null }} ids per-device case IDs
 * @returns {string|null} the case ID that was attached (null when none)
 */
export function attachTestRailCaseId(testInfo, ids = {}) {
  const caseId = deviceTag(testInfo) === 'mobile' ? ids.mobile : ids.web;
  if (!caseId) return null;

  testInfo.annotations.push({ type: 'testrail_case_id', description: caseId });
  return caseId;
}
