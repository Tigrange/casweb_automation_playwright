// Login page-object registry. Selects the right login implementation per
// partner.
//
// The default `LoginPopup` is built on the dev-team `automation` attributes
// shared by most partners. When a partner serves a different DOM — or even a
// different login *flow* (extra steps, different error handling, redirects) —
// register a dedicated subclass here keyed by partner id. The subclass can
// extend `LoginPopup` and override selectors, add steps, or replace methods
// entirely.
//
// Example:
//
//   import { LoginPopup } from '../pages/auth/LoginPopup.js';
//   class TotoroLoginPopup extends LoginPopup {
//     get selectors() {
//       return {
//         loginTrigger: { desktop: '#js_mob_sign_in', mobile: '#js_mob_sign_in' },
//         container:   { desktop: '#loginForm',       mobile: '#loginForm' },
//         username:    { desktop: '#login_email',     mobile: '#login_email' },
//         password:    { desktop: '#login_password',  mobile: '#login_password' },
//         submit:      { desktop: '#login_submit',    mobile: '#login_submit' },
//       };
//     }
//     async open() { /* different flow */ }
//   }
//   const LOGIN_POPUPS = { totoro: TotoroLoginPopup };

import { LoginPopup } from '../pages/auth/LoginPopup.js';

/** Partner-id → login page-object class. Absent ids resolve to LoginPopup. */
const LOGIN_POPUPS = {
  // totoro: TotoroLoginPopup,
};

/**
 * Return a login popup object for the given partner.
 * @param {import('@playwright/test').Page} page
 * @param {string} [partnerId]
 * @returns {LoginPopup}
 */
export function getLoginPopup(page, partnerId) {
  const Cls = (partnerId && LOGIN_POPUPS[partnerId]) || LoginPopup;
  return new Cls(page);
}

export default getLoginPopup;