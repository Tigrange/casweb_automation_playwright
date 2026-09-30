// Single source of truth for test type/tag filtering.
//
// Tests carry plain-string tags (see the specs):
//   @positive / @negative  -> test type
//   @smoke / @regression   -> optional suite
//
// Both playwright.config.js (per-project grep) and the runAllPartners runner
// import from here, so the allowed values and the grep syntax never drift.

export const TEST_TYPES = ['positive', 'negative', 'all'];
export const TEST_TAGS = ['smoke', 'regression'];

/**
 * Build the test-title filter (grep) from a test type and optional tag.
 *
 * IMPORTANT: the filter is applied PER PROJECT in playwright.config.js, never
 * through the CLI `--grep` flag, so the untagged `setup` infrastructure project
 * always runs (it creates the storage-state every E2E test depends on).
 *
 * `all` contributes no type constraint (positive + negative). Combined matching
 * uses lookaheads so both tags must be present, e.g.
 *   type=positive, tag=smoke -> /(?=.*@positive)(?=.*@smoke)/
 *
 * @param {string} type one of TEST_TYPES
 * @param {string} [tag] one of TEST_TAGS
 * @returns {RegExp|undefined} undefined when no constraint is requested
 */
export function buildGrep(type, tag) {
  if (!TEST_TYPES.includes(type)) {
    throw new Error(`Unknown TEST_TYPE "${type}". Expected one of: ${TEST_TYPES.join(', ')}`);
  }
  if (tag && !TEST_TAGS.includes(tag)) {
    throw new Error(`Unknown TEST_TAG "${tag}". Expected one of: ${TEST_TAGS.join(', ')}`);
  }

  const parts = [];
  if (type !== 'all') parts.push(`@${type}`);
  if (tag) parts.push(`@${tag}`);

  // No parts -> no filter, so every E2E test in the project runs.
  return parts.length ? new RegExp(parts.map((part) => `(?=.*${part})`).join('')) : undefined;
}
