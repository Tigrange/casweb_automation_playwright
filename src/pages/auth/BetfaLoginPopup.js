import { LoginPopup } from './LoginPopup.js';
import { automationSelector } from '../../utils/automation.js';

export class BetfaLoginPopup extends LoginPopup {
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
      errorMessage: { desktop: '#loginerrormessage', mobile: '#loginerrormessage' }
    };
  }
  async open() {
    await super.open(); // Call the parent class's open() method to maintain the original behavior
    console.log("BetfaLoginPopup open() called"); // custom code for BetfaLoginPopup
  }
  //override other methods if needed or add new methods specific to BetfaLoginPopup

}

