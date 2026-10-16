// @ts-check
import { defineConfig, devices } from '@playwright/test';
import { getRuntimeConfig } from './src/config/index.js';
import { buildGrep } from './src/config/testFilters.js';
import { getArtifactPaths } from './scripts/lib/artifacts.js';

/**
 * Cazweb Automation — Playwright config.
 *
 * Environments:  PLAYWRIGHT_ENV=test|prod   (prod is default; the registered
 *                partners only configure prod, and requesting an unconfigured
 *                environment fails instead of silently falling back)
 * Partner:       PARTNER=totogaming         (see src/config/partners.js)
 * Test type:     TEST_TYPE=positive|negative|all   (positive is default)
 * Test tag:      TEST_TAG=smoke|regression         (optional, narrows the type)
 * Video:         PW_VIDEO=on                       (optional, OFF by default)
 * Feature:       PW_FEATURE=login|register|<name>  (optional; scopes artifacts)
 * Artifact root: PW_ARTIFACTS_DIR=<path>           (optional; default ./artifacts)
 *
 * Failed tests keep a screenshot and a trace (see `use` below) so the merged
 * HTML report shows the error, stack trace, screenshot and trace.
 *
 * Run `npx playwright test` to execute the 'test' environment for the
 * default partner. Real authentication happens once per device in the
 * `auth-desktop` / `auth-mobile` projects, which write the storage-state files
 * consumed (read-only) by the E2E/visual projects.
 */

// Resolve runtime defaults so baseURL etc. are injected into projects below.
const RUNTIME = getRuntimeConfig();

/**
 * Feature-scoped artifacts for DIRECT Playwright runs (the "run across all
 * partners" runners manage their own paths already). When PW_FEATURE is set,
 * `test-results/` and the HTML report go under
 * <ARTIFACT_ROOT>/<PW_FEATURE>/{test-results,report} using the SAME helper the
 * runners use (no duplicated path logic). When PW_FEATURE is unset, the default
 * repo-local test-results/ and playwright-report/ are kept.
 */
const FEATURE_PATHS = process.env.PW_FEATURE ? getArtifactPaths(process.env.PW_FEATURE) : null;

/**
 * Test-title filter (grep) built from TEST_TYPE / TEST_TAG.
 *
 * The allowed values and the grep syntax live in src/config/testFilters.js so
 * this config and the runAllPartners runner stay in sync. Filtering is applied
 * PER PROJECT below, never through the CLI `--grep` flag, so the untagged
 * `setup` project is never filtered out.
 *
 * REMINDER: the default test type is POSITIVE-ONLY. Pass TEST_TYPE=all
 * (or --type=all to a runner script) to also run negative tests.
 */
const testType = process.env.TEST_TYPE || 'positive';
const testTag = process.env.TEST_TAG;
const TEST_GREP = buildGrep(testType, testTag);

export default defineConfig({
  testDir: './tests',

  /** Fully parallel E2E execution. */
  fullyParallel: true,

  /** Fail the build on CI if test.only is left in source. */
  forbidOnly: !!process.env.CI,

  /** Retry on CI only. */
  retries: process.env.CI ? 2 : 0,

  /** Limit workers on CI. */
  workers: process.env.CI ? 1 : undefined,

  // Feature-scoped raw artifacts (traces/screenshots) for direct runs.
  outputDir: FEATURE_PATHS ? FEATURE_PATHS.testResults : undefined,

  // Feature-scoped HTML report for direct runs; otherwise the default.
  reporter: FEATURE_PATHS
    ? [['html', { outputFolder: FEATURE_PATHS.report, open: 'never' }]]
    : 'html',

  /** Production sites are slow; give each test and assertion more headroom. */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: RUNTIME.baseURL,
    // Failure artifacts: capture a screenshot and a trace for failed tests so the
    // merged HTML report is actually usable (error, stack trace, screenshot,
    // trace). Video stays OFF by default because it costs CPU/RAM on every test;
    // set PW_VIDEO=on to keep videos of failed tests.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: process.env.PW_VIDEO === 'on' ? 'retain-on-failure' : 'off',
    navigationTimeout: 50_000,
  },

  projects: [
    /**
     * Real desktop authentication. Performs the ONLY desktop username/password
     * login per partner and writes <env>-<partner>-desktop.json. Chromium,
     * Firefox and WebKit depend on this and only verify the restored session.
     *
     * NOTE: deliberately NOT filtered by TEST_GREP — it is infrastructure and
     * must always run to produce the storage state the E2E projects reuse.
     */
    {
      name: 'auth-desktop',
      testMatch: /support[\\/]setup\.desktop\.spec\.js/,
      fullyParallel: false,
      // Real logins are slow (often 40s+ on these production sites) and can
      // exceed the global 60s limit when partners run in parallel, so give the
      // auth projects extra headroom.
      timeout: 120_000,
      use: { ...devices['Desktop Chrome'] },
    },

    /**
     * Real mobile authentication. Mobile has a different login DOM, so it does
     * its own real login (never the desktop one) and writes
     * <env>-<partner>-mobile.json, consumed by the mobile Chromium project.
     */
    {
      name: 'auth-mobile',
      testMatch: /support[\\/]setup\.mobile\.spec\.js/,
      fullyParallel: false,
      // See auth-desktop: real logins need more than the global 60s under load.
      timeout: 120_000,
      use: { ...devices['Pixel 5'] },
    },

    /**
     * E2E — cross browser, fast. Excludes auth setup + visual suites.
     * `grep: TEST_GREP` applies the positive/negative + tag filter here only
     * (positive-only by default; see TEST_TYPE above). `metadata.authDevice`
     * tells the session-check tests which storage-state file to load.
     * `grepInvert` drops tests tagged `@mobile-only` (mirror of
     * e2e-mobile-chromium's `@desktop-only` exclusion).
     */
    {
      name: 'e2e-chromium',
      testIgnore: [/support[\\/]setup\.(desktop|mobile)\.spec\.js/, /auth[\\/]register\.spec\.js/, /visual[\\/]/ ],
      grep: TEST_GREP,
      grepInvert: /@mobile-only/,
      metadata: { authDevice: 'desktop' },
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-desktop'],
    },
    // {
    //   name: 'e2e-firefox',
    //   testIgnore: [/support[\\/]setup\.(desktop|mobile)\.spec\.js/, /auth[\\/]register\.spec\.js/, /visual[\\/]/, /storageState/],
    //   grep: TEST_GREP,
    //   metadata: { authDevice: 'desktop' },
    //   use: { ...devices['Desktop Firefox'] },
    //   dependencies: ['auth-desktop'],
    // },
    // {
    //   name: 'e2e-webkit',
    //   testIgnore: [/support[\\/]setup\.(desktop|mobile)\.spec\.js/, /auth[\\/]register\.spec\.js/, /visual[\\/]/, /storageState/],
    //   grep: TEST_GREP,
    //   metadata: { authDevice: 'desktop' },
    //   use: { ...devices['Desktop Safari'] },
    //   dependencies: ['auth-desktop'],
    // },

    /**
     * Mobile template (Pixel 5 Android). Depends on the mobile auth project and
     * reuses the mobile storage state.
     *
     * `grepInvert` drops tests tagged `@desktop-only` from the mobile run, so a
     * test can be desktop-only (tagged in its spec) without any device checks in
     * the test body. It combines with `grep` (type/tag filter). Tag a spec with
     * `@mobile-only` and add the mirror here if a mobile-only test is ever
     * needed.
     */
    {
      name: 'e2e-mobile-chromium',
      testIgnore: [/support[\\/]setup\.(desktop|mobile)\.spec\.js/, /auth[\\/]register\.spec\.js/, /visual[\\/]/, /storageState/],
      grep: TEST_GREP,
      grepInvert: /@desktop-only/,
      metadata: { authDevice: 'mobile' },
      use: { ...devices['Pixel 5'] },
      dependencies: ['auth-mobile'],
    },
    /**
     * Registration — COMPLETELY INDEPENDENT of authentication. No
     * `dependencies` and no storageState, so register.spec.js always starts from
     * a clean logged-out context and a Register run performs ZERO real logins.
     * Register is kept in its own projects (not the auth-dependent e2e-* ones),
     * which is why the e2e-* projects ignore register.spec.js. Mirrors the
     * existing register coverage: Desktop Chrome + mobile Chromium.
     */
    {
      name: 'register-chromium',
      testMatch: /auth[\\/]register\.spec\.js/,
      grep: TEST_GREP,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'register-mobile-chromium',
      testMatch: /auth[\\/]register\.spec\.js/,
      grep: TEST_GREP,
      use: { ...devices['Pixel 5'] },
    },

    /**
     * Visual regression — chromium-only and sequential for stable, comparable
     * screenshots. Baselines live under src/visual/.
     */
    {
      name: 'visual',
      testMatch: /visual[\\/].*\.spec\.js/,
      fullyParallel: false,
      dependencies: ['auth-desktop'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Optional: boot a local dev server before tests. Uncomment and adjust.
  // webServer: {
  //   command: 'npm run start',
  //   url: RUNTIME.baseURL,
  //   reuseExistingServer: !process.env.CI,
  // },
});