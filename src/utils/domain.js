// Domain-rotation candidates for partners whose hostname ends in digits.
//
// Some partners rotate their production domain by bumping a trailing number
// (e.g. cozbet002.com -> cozbet003.com -> cozbet004.com ...). The old domain can
// go dead or serve a block page while the new one is live. This helper yields
// the configured URL first and then the same host with the trailing number
// incremented, preserving zero-padding (002 -> 003 -> 004 ...).
//
// Hosts without a trailing number (totogaming.am, totogaming.ro, betfa.com,
// manotobet... etc.) yield a single candidate, so unrelated partners are
// completely unaffected.

/**
 * Build the ordered domain candidates for a base URL.
 *
 * @param {string} baseURL e.g. 'https://cozbet002.com/en'
 * @param {number} [maxSteps=5] how many increments to try after the original
 * @returns {string[]} absolute URLs, original first
 */
export function domainCandidates(baseURL, maxSteps = 5) {
  let url;
  try {
    url = new URL(baseURL);
  } catch {
    return [baseURL];
  }

  // The rotating number sits right before the TLD(s): cozbet002.com,
  // partner03.co.uk. Anything else (no trailing number in that label) is
  // treated as a single candidate.
  const match = url.hostname.match(/^(.*?)(\d+)(\.[^.]+(?:\.[^.]+)*)$/i);
  if (!match) return [baseURL];

  const [, prefix, digits, suffix] = match;
  const width = digits.length;
  const start = Number(digits);

  const out = [baseURL];
  for (let step = 1; step <= maxSteps; step += 1) {
    const host = prefix + String(start + step).padStart(width, '0') + suffix;
    out.push(new URL(url.pathname + url.search, `${url.protocol}//${host}`).href);
  }
  return out;
}

export default domainCandidates;
