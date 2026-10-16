// Change-password page object. Device-aware: Cazweb serves different HTML for
// desktop vs mobile, so each element is resolved by semantic name against the
// active device's template (BasePage).
//
// The default implementation is built on the shared `automation` attributes
// used by the dev-team's templates, falling back to the known role/text
// selectors of the current build. When a partner serves a different DOM,
// register a dedicated subclass in src/factories/changePasswordRegistry.js.
//
// Element contract (semantic keys):
//   openTrigger      user-menu entry that opens the "change password" view
//   changeMenuItem   the "Изменить пароль" / "Change password" menu item
//   currentPassword  current-password input
//   newPassword      new-password input
//   confirmPassword  confirm-password input
//   submit           submit button
//   successMessage   success confirmation ("Пароль успешно изменён")
//   validationError  mismatch/invalid-password error message
//
// TODO: replace the role/text selectors below with the dev-team `automation`
// attributes once they are added, so the object stops depending on locale text.

import BasePage from '../BasePage.js';
import { expect } from '@playwright/test';

export class ChangePasswordPage extends BasePage {
  /** Device-aware selectors per semantic name. */
  get selectors() {
    return {
      // TODO: verify/open via automation attribute; text is locale-dependent.
      accountMenuTrigger: {
        desktop: '.username_cont',
        mobile: '#js_nav_right_toggle_btn',
      },
      changePasswordForm: {
        desktop: '#passwchangeContent',
        mobile: '#changepassForm',
      },
      changeMenuItem: {
        desktop: '.passwchangeDialog',
        mobile: '.rm_changepass',
      },
      currentPassword: {
        desktop: '#OldPassword',
        mobile: '#OldPassword',
      },
      newPassword: {
        desktop: '#NewPassword',
        mobile: '#NewPassword',
      },
      confirmPassword: {
        desktop: '#ConfirmPassword',
        mobile: '#ConfirmPassword',
      },
      submit: {
        desktop: '.changepass_btn',
        mobile: '#save_pass_d',
      },
      successMessage: {
        desktop: '.about-changet-pass',
        mobile: '.successmassage',
      },
      // TODO: verify the exact mismatch/validation error selector.
      validationError: {
        desktop: '.errormassage',
        mobile: '.field-validation-error',
      },
    };
  }

  constructor(page) {
    super(page);
    this.accountMenuTrigger = this.sel('accountMenuTrigger').first();
    this.changePasswordForm = this.sel('changePasswordForm').first();
    this.changeMenuItem = this.sel('changeMenuItem').first();
    this.currentPasswordInput = this.sel('currentPassword');
    this.newPasswordInput = this.sel('newPassword');
    this.confirmPasswordInput = this.sel('confirmPassword');
    this.submitButton = this.sel('submit');
    this.successMessage = this.sel('successMessage');
    this.validationError = this.sel('validationError');
  }

  /**
   * Open the change-password form from the logged-in header.
   * The username menu entry is dynamic (the player's own username), so it is
   * resolved by text rather than a static selector.
   * @param {string} username the logged-in player's username
   */
  async open() {
    await this.accountMenuTrigger.click();
    await this.changeMenuItem.click();
    await this.changePasswordForm.waitFor({ state: 'visible' });
  }

  /**
   * Fill the three password fields and submit. Does NOT assume success — call
   * expectSuccessVisible() (success) or expectMismatchErrorVisible() (failure).
   * @param {string} current current password
   * @param {string} next new password
   * @param {string} confirm confirmation (may differ from `next` on purpose)
   */
  async changePassword(current, next, confirm) {
    await this.currentPasswordInput.fill(current);
    await this.newPasswordInput.fill(next);
    await this.confirmPasswordInput.fill(confirm);
    await this.submitButton.click();
  }

  /** Wait until the success confirmation is shown. */
  async expectSuccessVisible() {
    await expect(this.successMessage).not.toBeEmpty();
  }
  /** Wait until a password validation/mismatch error is shown. */
  async expectMismatchErrorVisible() {
    await expect(this.validationError).not.toBeEmpty();
  }
}

export default ChangePasswordPage;
