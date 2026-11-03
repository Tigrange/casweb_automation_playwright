// Romanian CNP (Cod Numeric Personal) generator.
//
// Format: S YY MM DD JJ NNN C (13 digits)
//   S   - sex + century digit: 1/2 = M/F born 1900-1999, 3/4 = 1800-1899,
//         5/6 = 2000-2099
//   YY  - year of birth (last two digits)
//   MM  - month of birth (01-12)
//   DD  - day of birth (01-31)
//   JJ  - county code (01-46, 51, 52)
//   NNN - serial number (001-999)
//   C   - checksum (weighted sum of the first 12 digits modulo 11; 10 -> 1)
//
// The produced value is a syntactically valid CNP and matches what public CNP
// generators emit, without any external service.

/** Weights applied to the first 12 digits to compute the checksum digit. */
const CHECKSUM_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

/** Valid Romanian county codes. */
const COUNTY_CODES = [
  ...Array.from({ length: 46 }, (_, i) => String(i + 1).padStart(2, '0')),
  '51',
  '52',
];

/** @returns {number} a random integer in [min, max] inclusive. */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sex/century digit for the CNP.
 * @param {'M'|'F'} gender
 * @param {number} year
 */
function sexCenturyDigit(gender, year) {
  const male = gender === 'M';
  if (year >= 2000) return male ? 5 : 6;
  if (year >= 1900) return male ? 1 : 2;
  return male ? 3 : 4;
}

/**
 * Compute the CNP checksum digit for the first 12 digits.
 * @param {string} first12
 */
function checksumDigit(first12) {
  const sum = first12
    .split('')
    .reduce((acc, digit, i) => acc + Number(digit) * CHECKSUM_WEIGHTS[i], 0);
  const remainder = sum % 11;
  return remainder === 10 ? 1 : remainder;
}

/**
 * Generate a valid Romanian CNP.
 *
 * @param {{ year?: number, month?: number, day?: number, gender?: 'M'|'F' }} [options]
 * @returns {string} 13-digit CNP
 */
export function generateCnp({ year = 1990, month = 1, day = 1, gender = 'M' } = {}) {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid birthdate for CNP: ${year}-${month}-${day}`);
  }

  const county = COUNTY_CODES[randomInt(0, COUNTY_CODES.length - 1)];
  const serial = String(randomInt(1, 999)).padStart(3, '0');
  const first12 =
    `${sexCenturyDigit(gender, year)}` +
    `${String(year % 100).padStart(2, '0')}` +
    `${String(month).padStart(2, '0')}` +
    `${String(day).padStart(2, '0')}` +
    county +
    serial;

  return `${first12}${checksumDigit(first12)}`;
}

export default generateCnp;
