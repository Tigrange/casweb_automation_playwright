// Random test-data generators and small reusable helpers.

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random alphanumeric string.
 * @param {number} [length]
 */
export function randomString(length = 8) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

/**
 * Generate a unique-ish email for registration tests.
 */
export function randomEmail(prefix = 'qa') {
  return `${prefix}.${randomString(10)}@example.com`;
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