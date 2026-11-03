// Change-password page-object registry. Selects the right change-password
// implementation per partner — mirrors loginRegistry.js.
//
// The default `ChangePasswordPage` is built on the dev-team `automation`
// attributes shared by most partners. When a partner serves a different DOM —
// or a different flow — register a dedicated subclass here keyed by partner id.
// The subclass can extend `ChangePasswordPage` and override selectors, add
// steps, or replace methods entirely.
//
// Example:
//
//   import { ChangePasswordPage } from '../pages/change_password/ChangePasswordPage.js';
//   class CozbetChangePasswordPage extends ChangePasswordPage {
//     get selectors() { return { ...super.selectors, submit: { desktop: '...', mobile: '...' } }; }
//   }
//   const CHANGE_PASSWORD_PAGES = { cozbet: CozbetChangePasswordPage };

import { ChangePasswordPage } from '../pages/change_password/ChangePasswordPage.js';
import { CozbetChangePasswordPage } from '../pages/change_password/CozbetChangePasswordPage.js';
import { ManotoChangePasswordPage } from '../pages/change_password/ManotoChangePasswordPage.js';

/** Partner-id → change-password page-object class. Absent ids use the default. */
const CHANGE_PASSWORD_PAGES = {
  cozbet: CozbetChangePasswordPage,
  manoto: ManotoChangePasswordPage,
};

/**
 * Return a change-password page object for the given partner.
 * @param {import('@playwright/test').Page} page
 * @param {string} [partnerId]
 * @returns {ChangePasswordPage}
 */
export function getChangePasswordPage(page, partnerId) {
  const Cls = (partnerId && CHANGE_PASSWORD_PAGES[partnerId]) || ChangePasswordPage;
  return new Cls(page);
}

export default getChangePasswordPage;
