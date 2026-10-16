// Cozbet change-password page object. Cozbet renders a different DOM for the
// change-password flow than the shared template, so it overrides only the
// selectors that differ (same idiom as CozbetLoginPopup).
//
// TODO: fill in Cozbet's real selectors once available; everything else is
// inherited from ChangePasswordPage.

import { ChangePasswordPage } from './ChangePasswordPage.js';

export class CozbetChangePasswordPage extends ChangePasswordPage {
  get selectors() {
    return {
      ...super.selectors,
      changeMenuItem: { 
        desktop: '.passwchangeDialog',
        mobile: '#js_changepass_rm',
      },
      // TODO: override the Cozbet-specific selectors here, e.g.:
      // changeMenuItem: { desktop: '...', mobile: '...' },
      // currentPassword: { desktop: '...', mobile: '...' },
      // newPassword: { desktop: '...', mobile: '...' },
      // confirmPassword: { desktop: '...', mobile: '...' },
      // submit: { desktop: '...', mobile: '...' },
      // successMessage: { desktop: '...', mobile: '...' },
      // validationError: { desktop: '...', mobile: '...' },
    };
  }
}

export default CozbetChangePasswordPage;
