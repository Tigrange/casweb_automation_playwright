// Registration page object. TotoGaming registration is a full *page* at
// /registration/register (not a modal popup). Reachable from the header
// `#js_mob_sign_up` link or the login page `#register_in_login` link.
//
// The form is multi-step (a hidden `#CurrentStep` input tracks progress), but
// every field for both steps is present in the DOM from the start — later
// steps are revealed by clicking the "Continue"/submit button
// (`#js_reg_btn_submit`), which is disabled until the visible step is valid.
//
// Validation is ASP.NET unobtrusive: each field carries `data-val-*`
// attributes and errors render into `span.dyn_err_mess[data-valmsg-for="<Id>"]`.
//
// The submit is gated by an invisible Cloudflare Turnstile — this object does
// NOT attempt to solve/bypass it. It covers field interaction and validation
// up to (but not including) the final submit.

import BasePage from '../../BasePage.js';
import { automationSelector } from '../../../utils/automation.js';

export class RegisterPopup extends BasePage {
  /** Per-screen selector map. Selects use native HTML ids (no `automation`). */
  get selectors() {
    return {
      // Header trigger that opens the registration dialog.
      openTrigger: {
        desktop: automationSelector('open_register'),
        mobile: '#js_mob_sign_up'
      },
      container: {
        desktop: "#js_reg_form",
        mobile: '#js_reg_form',//missing mobile selector for login form
      },
      username: { desktop: '#UserName', mobile: '#UserName' },
      email: { desktop: '#Email', mobile: '#Email' },
      mobileCode: { desktop: '#MobileCode', mobile: '#MobileCode' },
      mobile: { desktop: '#Mobile', mobile: '#Mobile' },
      password: { desktop: '#Password', mobile: '#Password' },
      passwordValidation: { desktop: '#PasswordValidation', mobile: '#PasswordValidation' },
      referralId: { desktop: '#ReferralId', mobile: '#ReferralId' },
      currency: { desktop: '#Currency', mobile: '#Currency' },

      // Step 2 (identity + documents + consent)
      firstName: { desktop: '#FirstName', mobile: '#FirstName' },
      lastName: { desktop: '#LastName', mobile: '#LastName' },
      dobDay: { desktop: '#DateOfBirthDay', mobile: '#DateOfBirthDay' },
      dobMonth: { desktop: '#DateOfBirthMonth', mobile: '#DateOfBirthMonth' },
      dobYear: { desktop: '#DateOfBirthYear', mobile: '#DateOfBirthYear' },
      country: { desktop: '#Country', mobile: '#Country' },
      documentType: { desktop: '#DocumentType', mobile: '#DocumentType' },
      documentNumber: { desktop: '#DocumentNumber', mobile: '#DocumentNumber' },
      termsAndConditions: { desktop: '#GeneralTermsAndConditions', mobile: '#GeneralTermsAndConditions' },
      gdprMessage: { desktop: '#GDPRMessage', mobile: '#GDPRMessage' },
      gdprEmail: { desktop: '#GDPREmail', mobile: '#GDPREmail' },
      gdprPhone: { desktop: '#GDPRPhone', mobile: '#GDPRPhone' },

      submit: { desktop: '#js_reg_btn_submit', mobile: '#js_reg_btn_submit' },
      back: { desktop: '#js_reg_btn_back', mobile: '#js_reg_btn_back' },
    };
  }

  constructor(page) {
    super(page);
    this.container = this.sel('container');
    this.openTrigger = this.sel('openTrigger').first();
    this.submitButton = this.sel('submit', this.container);
    this.backButton = this.sel('back', this.container);
  }

  /** Fields that use the select2 widget (native select is hidden). */
  static select2Fields = ['mobileCode', 'currency', 'dobDay', 'dobMonth', 'dobYear', 'country', 'documentType'];

  /** Native `<select>` id for the given semantic field. */
  selectId(key) {
    const selector = this.selectors[key][this.device];
    return selector.replace('#', '');
  }

  /** Generic field locator (text inputs, checkboxes, selects). */
  field(key) {
    return this.sel(key, this.container);
  }

  /**
   * Open the login dialog and wait for it to be visible.
   * Uses a programmatic click: some partner test environments clone the page
   * (e.g. a widgets container re-renders the header), producing overlapping
   * duplicate triggers. The topmost clone would swallow a real pointer click,
   * so we dispatch the click directly on the first (real) trigger.
   */
  async open() {
    await this.openTrigger.evaluate((el) => el.click());
    await this.container.waitFor({ state: 'visible' });
  }



  /** Fill a text input. */
  async fillField(key, value) {
    await this.field(key).fill(value);
  }

  /**
   * Fill the identity fields unique to a partner. Default (TotoGaming) uses a
   * `username`; partners whose Step 1 collects different identity data (e.g.
   * Betfa's first/last name + date of birth) override this.
   * @param {Record<string, string>} data
   */
  async fillIdentity(data) {
    await this.fillField('username', data.username);
  }

  /**
   * Fill every Step 1 field: the partner-specific identity via fillIdentity(),
   * then the fields shared across partners.
   * @param {Record<string, string>} data
   */
  async fillStep1(data) {
    await this.fillIdentity(data);
    await this.fillField('email', data.email);
    await this.fillField('mobile', data.mobile);
    await this.fillField('password', data.password);
    await this.fillField('passwordValidation', data.passwordValidation);
    await this.select2('currency', data.currency);
    await this.field('passwordValidation').press('Tab');
  }

  /**
   * Select a value from a select2 dropdown by the underlying native option
   * value (e.g. 'USD', '1'). The rendered option label is localized per
   * partner (Betfa shows Persian labels), so the label is resolved from the
   * native `<select>` to keep selection language-independent.
   */
  async select2(key, value) {
    const id = this.selectId(key);
    const label = await this.page.locator(`#${id} option[value="${value}"]`).textContent();
    await this.page.locator(`#select2-${id}-container`).click();
    await this.page
      .locator('.select2-results__option:visible')
      .getByText(label.trim(), { exact: true })
      .first()
      .click();
  }

  /** Toggle a consent/terms checkbox (native input is styled/opaque). */
  async toggleCheckbox(key, checked = true) {
    const el = this.field(key);
    if (checked) await el.check({ force: true });
    else await el.uncheck({ force: true });
  }

  /** Locator for a field's validation message span. */
  error(key) {
    return this.page.locator(`[data-valmsg-for="${this.selectId(key)}"]`);
  }

  /** Wait for a field's validation message to become visible. */
  async expectErrorVisible(key) {
    await this.error(key).waitFor({ state: 'visible' });
  }

  /** Click the primary action button (advances steps / submits). */
  async continue() {
    await this.submitButton.click();
  }

  /** Click the back button (returns to the previous step). */
  async goBack() {
    await this.backButton.click();
  }
}

export default RegisterPopup;