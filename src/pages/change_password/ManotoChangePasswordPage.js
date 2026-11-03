// Manoto change-password page object. Manoto serves the change-password form at
// /account/resetpassword on BOTH desktop and mobile. The field ids, submit,
// success and error markup match the shared template, but the way you reach the
// form differs, so only the navigation selectors are overridden here.
//
// Desktop: profile nav link (a[href="/account/profilestatic"]) then the
//          "change password" menu item (a[href="/account/resetpassword"]).
// Mobile:  right-hand account menu (#js_nav_right_toggle_btn) then
//          #js_changepass_rm.

import { ChangePasswordPage } from './ChangePasswordPage.js';

export class ManotoChangePasswordPage extends ChangePasswordPage {
  get selectors() {
    return {
      ...super.selectors,
      accountMenuTrigger: {
        desktop: 'a[href="/account/profilestatic"]',
        mobile: '#js_nav_right_toggle_btn',
      },
      changeMenuItem: {
        desktop: '.static_menu-item[href="/account/resetpassword"]',
        mobile: '#js_changepass_rm',
      },
      changePasswordForm: {
        desktop: '#changepassForm',
        mobile: '#changepassForm',
      },
      // Manoto renders validation errors (e.g. new != confirm) in the
      // field-validation-error span, not in .errormassage on desktop.
      validationError: {
        desktop: '.field-validation-error',
        mobile: '.field-validation-error',
      },
    };
  }
}

export default ManotoChangePasswordPage;
