// Random test-data generators and small reusable helpers.

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random alphanumeric string.
 * @param {number} [length]
 */
export function randomString(length = 8, charset = CHARS) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

/**
 * Generate a unique-ish email for registration tests.
 */
export function randomEmail(prefix = 'qa', domain = 'example.com') {
  return `${prefix}.${randomString(10)}@${domain}`;
}

/**
 * A strong default password satisfying typical complexity rules.
 */
export function randomPassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function randomPhoneNumber(prefix = '+1', length = 10) {
  const number = Math.floor(Math.random() * Math.pow(10, length)) // Generate a random number with the specified length
  return `${prefix}${number}`;
}