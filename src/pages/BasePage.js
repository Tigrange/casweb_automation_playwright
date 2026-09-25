// Base class for all page/popup objects.
//
// Two responsibilities:
//  1. Device awareness — Cazweb serves different HTML for desktop vs mobile.
//     BasePage reads the active viewport width and sets `this.device` to
//     'desktop' or 'mobile'. Subclasses declare a `selectors` map so the same
//     semantic name resolves to the right DOM on each device.
//  2. Attribute helper — convenient lookup of `automation="<key>"` elements
//     (decoupled from CSS classes).
//
// Subclasses are created with `(page[, baseURL])`.

import { automationSelector } from '../utils/automation.js';
import { getDevice } from '../utils/device.js';

export class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [baseURL]
   */
  constructor(page, baseURL) {
    this.page = page;
    this.baseURL = baseURL;
    this.device = this.detectDevice(page);
  }

  /** @returns {string} 'mobile' when viewport is narrow, else 'desktop'. */
  detectDevice(page) {
    return getDevice(page);
  }

  /**
   * Per-screen selector map. Override in subclasses, keyed by a semantic name,
   * each with `{ desktop: <selector>, mobile: <selector> }`:
   *
   *   get selectors() {
   *     return { loginTrigger: { desktop: '...', mobile: '...' } };
   *   }
   *
   * @returns {Record<string, { desktop: string, mobile: string }>}
   */
  get selectors() {
    return {};
  }

  /**
   * Generic locator lookup for elements that don't carry an `automation`
   * attribute. Optional `scope` constrains to a container locator.
   *
   * @param {string} selector CSS selector
   * @param {import('@playwright/test').Locator} [scope]
   */
  locator(selector, scope) {
    return (scope || this.page).locator(selector);
  }

  /**
   * Device-aware semantic lookup. Resolves `key` against `this.selectors`
   * for the current device; falls back to `[automation="<key>"]` when the key
   * is not declared. Optional `scope` constrains the search.
   *
   * @param {string} key semantic name
   * @param {import('@playwright/test').Locator} [scope]
   */
  sel(key, scope) {
    const entry = this.selectors && this.selectors[key];
    const selector = entry ? entry[this.device] : automationSelector(key);
    return this.locator(selector, scope);
  }

  /**
   * Locator for an element marked `automation="<key>"`.
   * Pass an optional `scope` (locator, e.g. a popup container) to constrain.
   *
   * @param {string} key
   * @param {import('@playwright/test').Locator} [scope]
   */
  automation(key, scope) {
    return this.locator(automationSelector(key), scope);
  }

  /** Shorthand alias for {@link automation}. */
  el(key, scope) {
    return this.automation(key, scope);
  }
}

export default BasePage;