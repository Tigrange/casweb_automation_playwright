// Inbox page-object registry. Selects the right inbox implementation per
// partner — mirrors loginRegistry.js / changePasswordRegistry.js.
//
// The default `InboxPage` covers the shared inbox template. Partner-specific
// subclasses are registered here and override only the selectors/methods that
// differ. Absent ids use the default.

import { InboxPage } from '../pages/inbox/InboxPage.js';

/** Partner-id → inbox page-object class. Absent ids use the default. */
const INBOX_PAGES = {};

/**
 * Return an inbox page object for the given partner.
 * @param {import('@playwright/test').Page} page
 * @param {string} [partnerId]
 * @returns {InboxPage}
 */
export function getInboxPage(page, partnerId) {
  const Cls = (partnerId && INBOX_PAGES[partnerId]) || InboxPage;
  return new Cls(page);
}

export default getInboxPage;
