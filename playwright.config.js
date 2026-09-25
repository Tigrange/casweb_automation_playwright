// @ts-check
import { defineConfig, devices } from '@playwright/test';
import { getRuntimeConfig } from './src/config/index.js';

/**
 * Cazweb Automation — Playwright config.
 *
 * Environments:  PLAYWRIGHT_ENV=test|prod   (test is default)
 * Partner:       PARTNER=totogaming         (see src/config/partners.js)
 *
 * Run `npx playwright test` to execute the 'test' environment for the
 * default partner. Authenticated storage-state is produced by the `setup`
 * project and consumed by the E2E/visual projects.
 */

// Resolve runtime defaults so baseURL etc. are injected into projects below.
const RUNTIME = getRuntimeConfig();

const STORAGE_PATH = `${process.cwd()}/tests/support/storageState/${RUNTIME.envName}-${RUNTIME.partnerId}.json`;

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

  reporter: 'html',

  use: {
    baseURL: RUNTIME.baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    /**
     * Auth setup. Logs in per partner/env and writes storage-state files that
     * all functional tests depend on. Run automatically before other projects.
     * Uses a desktop device so the desktop template (with automation attrs) is
     * served for capturing the stored session.
     */
    {
      name: 'setup',
      testMatch: /support[\\/]setup\.spec\.js/,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
    },

    /** E2E — cross browser, fast. Excludes setup support + visual suites. */
    {
      name: 'e2e-chromium',
      testIgnore: [/support[\\/]setup\.spec\.js/, /visual[\\/]/, /storageState/],
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'e2e-firefox',
      testIgnore: [/support[\\/]setup\.spec\.js/, /visual[\\/]/, /storageState/],
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'e2e-webkit',
      testIgnore: [/support[\\/]setup\.spec\.js/, /visual[\\/]/, /storageState/],
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    /**
     * Mobile templates (Pixel 5 Android / iPhone iOS). Device-aware page
     * objects handle the different mobile DOM. ENABLE when mobile coverage is
     * wanted; disabled by default so runs target the desktop website.
     */
    {
      name: 'e2e-mobile-chromium',
      testIgnore: [/support[\\/]setup\.spec\.js/, /visual[\\/]/, /storageState/],
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    // {
    //   name: 'e2e-mobile-webkit',
    //   testIgnore: [/support[\\/]setup\.spec\.js/, /visual[\\/]/, /storageState/],
    //   use: { ...devices['iPhone 12'] },
    //   dependencies: ['setup'],
    // },

    /**
     * Visual regression — chromium-only and sequential for stable, comparable
     * screenshots. Baselines live under src/visual/.
     */
    {
      name: 'visual',
      testMatch: /visual[\\/].*\.spec\.js/,
      fullyParallel: false,
      dependencies: ['setup'],
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