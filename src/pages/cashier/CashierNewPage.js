// New cashier (deposit) page object. Used by partners whose deposit flow is
// served by the new cashier — totoro (see `cashierNew` in
// src/config/partners.js).
//
// The new cashier is a self-contained deposit popup. We only assert that the
// popup OPENS: an internal "something went wrong" message is a partner-side
// issue and still counts as a PASS — the integration from our side works as
// long as the popup is displayed.
//
// Selectors follow the dev-team `automation` attribute convention. The popup
// DOM has not been captured yet: every key below is a best-effort placeholder
// and MUST be verified against a live desktop/mobile DOM before trusting it.

import BasePage from '../BasePage.js';
import { automationSelector } from '../../utils/automation.js';

export class CashierNewPage extends BasePage {
  /** Device-aware selectors per semantic name. */
  get selectors() {
    return {
      // Header button that opens the deposit popup.
      depositTrigger: {
        desktop: automationSelector('deposit_main_button'),
        mobile: '.cw_headerDropDown_mob_depositBtn', // TODO verify mobile trigger
      },
      // Deposit popup root that must become visible after open().
      container: {
        desktop: '#deposit', // TODO verify
        mobile: '#deposit', // TODO verify
      },
      cashierHeader: {
        desktop: '#cashier_text', // TODO verify
        mobile: '#cashier_text', // TODO verify
      },
    };
  }

  constructor(page) {
    super(page);
    this.container = this.sel('container');
    this.openTrigger = this.sel('depositTrigger').first();
  }

  /**
   * Open the deposit popup. Uses a programmatic click for the same reason as
   * the login/register popups (duplicate cloned header triggers).
   */
  async open() {
    await this.openTrigger.evaluate((el) => el.click());
  }

  /**
   * Assert the popup opened. Intentionally does NOT inspect the popup contents:
   * an in-popup error message is a partner-side problem, not ours.
   */
  async verifyDepositAvailable() {
    await this.container.waitFor({ state: 'visible' });
    await this.sel('cashierHeader', this.container).toHaveText('Cashier');
  }
}

export default CashierNewPage;
