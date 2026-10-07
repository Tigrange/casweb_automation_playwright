// Cashier page-object registry. Selects the right deposit implementation per
// partner — mirrors src/factories/loginRegistry.js.
//
// The choice comes from the partner config (`cashierNew` in
// src/config/partners.js): true → the new cashier popup, false/absent → the
// legacy cashier flow.
//
//   cashierNew: true   totoro
//   cashierNew: false  totogaming, cozbet, betfa

import { PARTNERS } from '../config/partners.js';
import { CashierOldPage } from '../pages/cashier/CashierOldPage.js';
import { CashierNewPage } from '../pages/cashier/CashierNewPage.js';

/**
 * Return a cashier page object for the given partner.
 * @param {import('@playwright/test').Page} page
 * @param {string} [partnerId]
 * @returns {CashierOldPage | CashierNewPage}
 */
export function getCashierPage(page, partnerId) {
  const cashierNew = partnerId ? PARTNERS[partnerId]?.cashierNew === true : false;
  return cashierNew ? new CashierNewPage(page) : new CashierOldPage(page);
}

export default getCashierPage;
