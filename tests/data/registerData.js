// Registration test data. Values shared by every partner live in COMMON;
// partner-specific values (identity fields, mobile format, email domain,
// currency, ...) are generated per partner id. `buildRegisterData(partnerId)`
// merges the two, with partner values taking precedence.

import { randomString, randomEmail, randomPassword } from '#src/utils/helpers.js';

/** Values valid for all partners. */
const COMMON = {
  password: randomPassword(12),
  currency: 'USD',
};

/**
 * Partner-specific value builders. Each returns the fields unique to that
 * partner's Step 1 (identity fields) plus any per-partner overrides of COMMON.
 */
const BY_PARTNER = {
  totogaming: () => ({
    username: `testuser_${randomString(8)}`,
    email: randomEmail('testuser'),
    mobile: `9${randomString(7, '0123456789')}`,
    currency: 'AMD',
  }),
  cozbet: () => ({
    username: `testuser_${randomString(8)}`,
    email: randomEmail('testuser', 'cozbet.com'),
    mobile: `9${randomString(7, '0123456789')}`,
    currency: 'USD',
  }),
  betfa: () => ({
    firstName: `Test${randomString(4)}`,
    lastName: `User${randomString(4)}`,
    dobDay: '1',
    dobMonth: '1',
    dobYear: '1990',
    email: randomEmail('testuser', 'betfa.com'),
    mobile: `9${randomString(9, '0123456789')}`,
    currency: 'USD',
  }),
  totoro: () => ({
    password: 'Admin123!',
    username: `testuser_${randomString(8)}`,
    firstName: `Test${randomString(4)}`,
    lastName: `User${randomString(4)}`,
    dobDay: '1',
    dobMonth: '1',
    dobYear: '1990',
    email: randomEmail('testuser', 'totoro.com'),
    mobile: `7${randomString(8, '0123456789')}`,
    currency: 'RON',
  })
};

/**
 * Build a complete Step 1 payload for the given partner.
 * Falls back to the TotoGaming shape for unregistered partners.
 *
 * @param {string} [partnerId]
 */
export function buildRegisterData(partnerId = 'totogaming') {
  const partner = (BY_PARTNER[partnerId] || BY_PARTNER.totogaming)();
  const data = { ...COMMON, ...partner };
  return { ...data, passwordValidation: data.password };
}

export default buildRegisterData;