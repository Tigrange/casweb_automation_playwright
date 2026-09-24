// Custom test fixture. Extends Playwright's `test` to expose a typed runtime
// context (resolved partner + env + credentials) and an API client bound to
// the target environment. Import this wherever you would import `@playwright/test`.

import { test as base, expect } from '@playwright/test';
import { getRuntimeConfig } from '../config/index.js';
import createApiClient from '../api/client.js';

export const test = base.extend({
  /** Resolved partner/env credential context for the active run. */
  runtime: async ({}, use) => {
    const config = getRuntimeConfig();
    await use(config);
  },

  /** REST client for setup/test-data, bound to the active base URL. */
  api: async ({ runtime }, use) => {
    const client = createApiClient(runtime.baseURL);
    await use(client);
  },
});

export { expect };
export default test;