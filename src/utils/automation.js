// Selector helpers built on the project's custom `automation` attribute.
//
// Convention: developers flag testable elements with:
//     <input type="text" automation="login-username" name="username" ... />
//
// Selectors written as `[automation="<key>"]` are stable and independent of
// CSS classes / styling, which change frequently.

/** Build the CSS selector for an `automation="<key>"` element. */
export const automationSelector = (key) => `[automation="${key}"]`;

/**
 * Return a locator for `automation="<key>"`, optionally scoped to a root
 * locator (e.g. a popup/dialog container) instead of the whole page.
 *
 * @param {import('@playwright/test').Page | import('@playwright/test').Locator} root
 * @param {string} key
 */
export const automation = (root, key) => root.locator(automationSelector(key));

export default automation;