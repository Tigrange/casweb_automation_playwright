import { RegisterPopup } from './RegisterPopup.js';
import { automationSelector } from '../../../utils/automation.js';

export class BetfaRegisterPopup extends RegisterPopup {
  get selectors() {
    return {
      ...super.selectors,
      // Header trigger that opens the registration dialog.
      openTrigger: {
        desktop: automationSelector('open_register'),
        mobile: '#js_mob_sign_up'
      },
      container: {
        desktop: "#js_reg_form",
        mobile: '#js_reg_form',//missing mobile selector for login form
      },
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

  /**
   * Betfa Step 1 collects name + date of birth instead of a username.
   * @param {Record<string, string>} data
   */
  async fillIdentity(data) {
    await this.fillField('firstName', data.firstName);
    await this.fillField('lastName', data.lastName);
    await this.select2('dobDay', data.dobDay);
    await this.select2('dobMonth', data.dobMonth);
    await this.select2('dobYear', data.dobYear);
  }
}