import { RegisterPopup } from './RegisterPopup.js';
import { automationSelector } from '../../../utils/automation.js';

export class TotoRoRegisterPopup extends RegisterPopup {
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

  /**
   * TotoRo Step 1 collects userName
   * @param {Record<string, string>} data
   */
  async fillStep1(data) {
    await this.fillIdentity(data);
    await this.fillField('mobile', data.mobile);
    await this.fillField('password', data.password);
    await this.fillField('passwordValidation', data.passwordValidation);
  }
}