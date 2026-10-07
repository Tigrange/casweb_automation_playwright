// Old cashier (deposit) page object. Used by partners whose deposit flow is
// served by the legacy cashier — totogaming, cozbet, betfa (see `cashierNew`
// in src/config/partners.js).
//
// Positive flow covered here (PROD-SAFE — never confirms a real payment):
//   1. open()               — click the header deposit trigger, wait for the
//                             cashier container.
//   2. verifyDepositAvailable() — pick the FIRST deposit method, enter an
//                             amount, assert the pay/continue button becomes
//                             ENABLED, click it and confirm we land on the
//                             payment page.
//
// Selectors follow the dev-team `automation` attribute convention. The cashier
// DOM has not been captured yet: every key below is a best-effort placeholder
// and MUST be verified against a live desktop/mobile DOM before trusting it.

import { expect } from '@playwright/test';
import BasePage from '../BasePage.js';
import { automationSelector } from '../../utils/automation.js';

export class CashierOldPage extends BasePage {
  /** Device-aware selectors per semantic name. */
  get selectors() {
    return {
      // Header button that opens the deposit flow (same marker used to detect
      // a logged-in desktop session — see src/config/authMarkers.js).
      depositTrigger: {
        desktop: automationSelector('deposit_main_button'),
        mobile: '.cw_headerDropDown_mob_depositBtn', // TODO verify mobile trigger
      },
      // Cashier root that must become visible after open().
      container: {
        desktop: '#deposit', // TODO verify
        mobile: '#deposit', // TODO verify
      },
      MenuItem: {
        desktop: '#deposit_tab', // TODO verify
        mobile: '#deposit_tab', // TODO verify
      },
      // Deposit-method tile; only the first one is exercised.
      method: {
        desktop: automationSelector('deposit_method'), // TODO verify
        mobile: automationSelector('deposit_method'), // TODO verify
      },
      // Amount input inside the selected method.
      amount: {
        desktop: automationSelector('deposit_amount'), // TODO verify
        mobile: automationSelector('deposit_amount'), // TODO verify
      },
      // Pay / continue button that submits the amount.
      payButton: {
        desktop: automationSelector('deposit_pay_button'), // TODO verify
        mobile: automationSelector('deposit_pay_button'), // TODO verify
      },
    };
  }

  constructor(page) {
    super(page);
    this.container = this.sel('container');
    this.openTrigger = this.sel('depositTrigger').first();
    this.amountInput = this.sel('amount', this.container);
    this.payButton = this.sel('payButton', this.container);
    this.menuItem = this.sel('MenuItem',this.page).first();
  }

  /**
   * Open the cashier and wait for it to be visible. Uses a programmatic click
   * for the same reason as the login/register popups: some partners clone the
   * header, producing duplicate triggers that swallow real pointer clicks.
   */
  async open() {
    await this.openTrigger.evaluate((el) => el.click());
    await this.container.waitFor({ state: 'visible' });
    await expect(this.menuItem).toContainClass('active');
  }

  /**
   * Assert the deposit flow is usable: first method opens, amount can be
   * entered and the pay button becomes enabled. Clicks pay only to confirm the
   * redirect to the payment page — the payment itself is never confirmed.
   *
   * @param {{ amount: string }} data
   */
  async verifyDepositAvailable({ amount }) { //TODO
    await this.sel('method', this.container).first().click();
    await this.amountInput.fill(amount);

    // Button must be clickable once a valid amount is entered.
    await expect(this.payButton).toBeEnabled();

    const before = this.page.url();
    await this.payButton.click();
    // Landing on the payment page means the redirect works (no payment is made).
    await this.page.waitForURL((url) => url.href !== before);
  }
}

export default CashierOldPage;
