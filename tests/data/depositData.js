// Deposit test data. `buildDepositData(partnerId)` returns the amount used by
// the positive deposit checks. Partner overrides take precedence over COMMON.

/** Values valid for all partners. */
const COMMON = {
  amount: '10',
};

/** Partner-specific overrides. */
const BY_PARTNER = {};

/**
 * Build the deposit payload for the given partner.
 * @param {string} [partnerId]
 */
export function buildDepositData(partnerId = 'totogaming') {
  return { ...COMMON, ...(BY_PARTNER[partnerId] || {}) };
}

export default buildDepositData;
