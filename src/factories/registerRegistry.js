// Registration page-object registry. Selects the right register implementation
// per partner — mirrors src/factories/loginRegistry.js.
//
// The default `RegisterPopup` targets the TotoGaming Step 1 (identity via
// `username`). Partners whose Step 1 collects different identity fields (e.g.
// Betfa: first/last name + date of birth, no username) register a subclass
// here keyed by partner id.

import { RegisterPopup } from '../pages/auth/RegisterPopup.js';
import { BetfaRegisterPopup } from '../pages/auth/BetfaRegisterPopup.js';

/** Partner-id → register page-object class. Absent ids resolve to RegisterPopup. */
const REGISTER_POPUPS = {
  betfa: BetfaRegisterPopup,
};

/**
 * Return a register popup object for the given partner.
 * @param {import('@playwright/test').Page} page
 * @param {string} [partnerId]
 * @returns {RegisterPopup}
 */
export function getRegisterPopup(page, partnerId) {
  const Cls = (partnerId && REGISTER_POPUPS[partnerId]) || RegisterPopup;
  return new Cls(page);
}

export default getRegisterPopup;