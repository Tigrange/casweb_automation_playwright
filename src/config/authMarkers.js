// Single source of truth for the "logged in" markers used to verify an
// authenticated session. Shared by the real-login setup (tests/support/
// authSetup.js) and the session-check test (tests/auth/login.spec.js) so the
// two can never drift. Selectors are intentionally unchanged.

import { automationSelector } from '../utils/automation.js';

/** Device → selector that is only present once authenticated. */
export const LOGGED_IN_MARKERS = {
  desktop: automationSelector('deposit_main_button'),
  mobile: '.tl_logged_in',
};

export default LOGGED_IN_MARKERS;
