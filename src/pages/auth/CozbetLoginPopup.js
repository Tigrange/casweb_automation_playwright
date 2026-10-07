import { LoginPopup } from './LoginPopup.js';
import { automationSelector } from '../../utils/automation.js';

export class CozbetLoginPopup extends LoginPopup {
  get selectors() {
    return {
      loginTrigger: {
        desktop: automationSelector('home_login_button'),
        mobile: '#js_mob_sign_in',
      },
      container: {
        desktop: automationSelector('login_form'),
        mobile: '#loginForm',////ONLY THIS IS DIFFERENT FROM LoginPopup.js
      },
      username: { desktop: automationSelector('email_input'), mobile: automationSelector('email_input') },
      password: { desktop: automationSelector('password_input'), mobile: automationSelector('password_input') },
      submit: { desktop: automationSelector('login_button'), mobile: '#staticLoginButton' },
      errorMessage: { desktop: '#loginerrormessage', mobile: '#loginerrormessage' }
    };
  }
}

