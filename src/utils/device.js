// Device detection shared by page objects and specs.
//
// Cazweb serves different HTML for desktop vs mobile. BasePage uses these
// helpers to keep page objects device-aware; specs use them for one-off
// device-dependent assertions without duplicating the breakpoint logic.

/** Viewport widths below this are treated as mobile. */
export const MOBILE_BREAKPOINT = 600;

/** @returns {'mobile'|'desktop'} based on the page's viewport width. */
export function getDevice(page) {
  const vp = page.viewportSize();
  return vp && vp.width < MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}

/** @returns {boolean} true when the page is rendered at a mobile viewport. */
export function isMobile(page) {
  return getDevice(page) === 'mobile';
}

/**
 * Resolve a `{ desktop, mobile }` selector pair into a locator for the
 * page's current device.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ desktop: string, mobile: string }} selectors
 */
export function deviceLocator(page, { desktop, mobile }) {
  return page.locator(isMobile(page) ? mobile : desktop);
}