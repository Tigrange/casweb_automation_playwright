// Login popup (modal) object. TotoGaming renders DIFFERENT HTML for desktop
// vs mobile, and clicking the header login navigates to /login/login (a log-in
// dialog). This object is device-aware: it resolves each element by semantic
// name against the active device's template.
//
// Desktop selectors use the dev-team `automation` attributes; mobile falls back
// to shared element ids (TRIGGER/SUBMIT on mobile still need verification).
//
// Element contract (desktop):
//   home_login_button   header link that opens the login dialog
//   login_form          the <form id="loginForm"> container
//   email_input         username input
//   password_input      password input
//   login_button        submit button (type="button")

import BasePage from '../../BasePage.js';
import { automationSelector } from '../../../utils/automation.js';

export class LoginPopup extends BasePage {
  /** Device-aware selectors per semantic name. */
  get selectors() {
    return {
      loginTrigger: {
        desktop: automationSelector('home_login_button'),
        mobile: '#js_mob_sign_in',
      },
      container: {
        desktop: automationSelector('login_form'),
        mobile: '#staticLogin',//missing mobile selector for login form
      },
      username: { desktop: automationSelector('email_input'), mobile: automationSelector('email_input') },
      password: { desktop: automationSelector('password_input'), mobile: automationSelector('password_input') },
      submit: { desktop: automationSelector('login_button'), mobile: '#staticLoginButton' },
      errorMessage: { desktop: '#loginError', mobile: '#loginerrormessage' },
      depositTrigger: {
        desktop: automationSelector('deposit_main_button'),
        mobile: '.cw_headerDropDown_mob_depositBtn', // TODO verify mobile trigger
      },
    };
  }

  constructor(page) {
    super(page);

    this.container = this.sel('container');
    this.openTrigger = this.sel('loginTrigger').first();
    this.usernameInput = this.sel('username', this.container);
    this.passwordInput = this.sel('password', this.container);
    this.submitButton = this.sel('submit', this.container);
    this.errorMessage = this.sel('errorMessage', this.container);
    this.depositTrigger = this.sel('depositTrigger').first();
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

  /**
   * Fill credentials and submit. Does NOT assume success — call
   * expectLoggedIn() (success) or expectErrorVisible() (failure) afterwards.
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    // Programmatic submit: partner pages show cookie-consent banners and promo
    // popups that can intercept a real pointer click on the submit button.
    await this.submitButton.evaluate((el) => el.click());
  }

  /** Wait until the login dialog closes — i.e. login succeeded. */
  async expectLoggedIn() {
    await this.container.waitFor({ state: 'hidden' });
    await this.depositTrigger.waitFor({ state: 'visible' });
  }

  async expectErrorVisible() {
    await this.errorMessage.waitFor({ state: 'visible' });
  }
}

export default LoginPopup;