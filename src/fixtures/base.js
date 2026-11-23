// Custom test fixture. Extends Playwright's `test` to expose a typed runtime
// context (resolved partner + env + optional credentials). Import this wherever
// you would import `@playwright/test`.

import { test as base, expect } from '@playwright/test';
import { resolveRuntimeConfig } from '../config/index.js';

export const test = base.extend({
  /** Resolved partner/env context for the active run (creds may be null). */
  runtime: async ({}, use) => {
    const config = await resolveRuntimeConfig();
    await use(config);
  },
});

export { expect };
export default test;