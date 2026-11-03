import { LoginPopup } from './LoginPopup.js';
import { automationSelector } from '../../../utils/automation.js';
import { ManotoHomePage } from '../../home/ManotoHomePage.js';

export class ManotoLoginPopup extends LoginPopup {
  get selectors() {
    return {
      loginTrigger: {
        desktop: automationSelector('home_login_button'),
        mobile: '#js_mob_sign_in',
      },
      container: {
        desktop: '#loginCont',
        mobile: '#sidebar-login',
      },
      username: { desktop: automationSelector('email_input'), mobile: automationSelector('email_input') },
      password: { desktop: automationSelector('password_input'), mobile: automationSelector('password_input') },
      submit: { desktop: automationSelector('login_button'), mobile: automationSelector('login_button') },
      errorMessage: { desktop: '#loginError', mobile: '#loginerrormessage' }, //ONLY THIS IS DIFFERENT FROM LoginPopup.js
      depositTrigger: {
        desktop: automationSelector('deposit_main_button'),
        mobile: '#depositDropDownToggler', // TODO verify mobile trigger
      },
    };
  }

  /**
   * Manoto serves the desktop version by default, even for a mobile viewport.
   * Force the version that matches this project's device before the
   * device-specific selectors are used.
   */
  async open() {
    await new ManotoHomePage(this.page).ensureVersion(this.device);
    await this.openTrigger.evaluate((el) => el.click());
    await this.container.waitFor({ state: 'visible' });
  }
}
