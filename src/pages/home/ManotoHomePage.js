// Manoto home page (footer version switcher).
//
// Manoto can serve either the desktop or the mobile version of the site for the
// SAME viewport. The choice is server-driven (via `/mobile/ismobile?ismobile=`),
// NOT derived from the viewport width — so `src/utils/device.js` cannot tell
// which version is rendered. Page-object state must therefore be asserted from
// DOM markers, never from `page.viewportSize()`.
//
// Desktop version: hidden `#switcher` checkbox + visible `label.switcher_elem`.
// Mobile version:  footer `div.toWeb` link back to the desktop version.

import { expect } from '@playwright/test';
import BasePage from '../BasePage.js';
import { getRuntimeConfig } from '#src/config/index.js';
import { waitForCloudflare, cloudflareBlockedError } from '#support/cloudflareEvidence.js';

/** Switching reloads the site through a slow redirect — allow extra time. */
const SWITCH_TIMEOUT = 60000;

export class ManotoHomePage extends BasePage {
  // NOTE: `this.device` (set by BasePage from the viewport) is NOT the served
  // version and goes stale after a switch. Every selector below is identical
  // for both device branches on purpose, so cached lookups stay valid.
  get selectors() {
    return {
      versionSwitcher: { desktop: '#switcher', mobile: '#switcher' },
      switchToMobileLabel: { desktop: 'label.switcher_elem[for="switcher"]', mobile: 'label.switcher_elem[for="switcher"]' },
      switchToDesktopLink: { desktop: 'div.toWeb', mobile: 'div.toWeb' },
    };
  }

  constructor(page) {
    super(page);
    this.versionSwitcher = this.sel('versionSwitcher');
    this.switchToMobileLabel = this.sel('switchToMobileLabel');
    this.switchToDesktopLink = this.sel('switchToDesktopLink');
  }

  /**
   * Switch from the desktop version to the mobile version. Programmatic click:
   * the server redirect is slow, and a real click would block waiting on it.
   */
  async switchToMobile() {
    await expect(this.versionSwitcher).toBeAttached({ timeout: SWITCH_TIMEOUT });
    // Retry: an early programmatic click (before the site's JS handlers are
    // ready) is a no-op on production, so click and VERIFY the mobile marker
    // repeatedly instead of clicking once and hoping. The switch endpoint is
    // Cloudflare-protected on production — detect the challenge and fail fast.
    await expect(async () => {
      if (await this.switchToDesktopLink.first().isVisible().catch(() => false)) return;
      await this.switchToMobileLabel.evaluate((el) => el.click()).catch(() => {});
      const outcome = await Promise.race([
        this.switchToDesktopLink
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .then(() => 'switched')
          .catch(() => null),
        waitForCloudflare(this.page, 10_000).then((cf) => (cf ? 'cloudflare' : null)),
      ]);
      if (outcome === 'cloudflare') {
        const { partnerId, envName } = getRuntimeConfig();
        throw await cloudflareBlockedError(this.page, { partnerId, envName, device: 'mobile' });
      }
      if (outcome !== 'switched') throw new Error('mobile version not rendered yet');
    }).toPass({ timeout: SWITCH_TIMEOUT, intervals: [500, 1_000, 2_000, 3_000] });
  }

  /**
   * Version currently rendered, read from DOM markers (not the viewport).
   * Waits for the page to settle on either version first.
   * @returns {Promise<'desktop'|'mobile'>}
   */
  async currentVersion() {
    await this.page.locator('#switcher, div.toWeb').first().waitFor({ state: 'attached', timeout: SWITCH_TIMEOUT });
    return (await this.versionSwitcher.count()) > 0 ? 'desktop' : 'mobile';
  }

  /**
   * Force the served version to `device`. Manoto defaults to the desktop
   * version regardless of viewport/UA, so a mobile project must switch
   * explicitly before using mobile selectors.
   * @param {'desktop'|'mobile'} [device] defaults to this page object's device
   */
  async ensureVersion(device = this.device) {
    const current = await this.currentVersion();
    if (device === 'mobile' && current === 'desktop') await this.switchToMobile();
    if (device === 'desktop' && current === 'mobile') await this.switchToDesktop();
  }

  /**
   * Switch from the mobile version back to the desktop version. Programmatic
   * click for the same reason as {@link switchToMobile}.
   */
  async switchToDesktop() {
    await expect(this.switchToDesktopLink.first()).toBeVisible({ timeout: SWITCH_TIMEOUT });
    // Same retry reasoning as switchToMobile (early clicks can be no-ops).
    await expect(async () => {
      if ((await this.versionSwitcher.count()) > 0) return;
      await this.switchToDesktopLink.first().evaluate((el) => el.click()).catch(() => {});
      await expect(this.versionSwitcher).toBeAttached({ timeout: 10_000 });
    }).toPass({ timeout: SWITCH_TIMEOUT, intervals: [500, 1_000, 2_000, 3_000] });
  }

  /** Assert the mobile version is currently rendered. */
  async expectMobileVersion() {
    await expect(this.switchToDesktopLink).toBeVisible({ timeout: SWITCH_TIMEOUT });
    await expect(this.versionSwitcher).toHaveCount(0);
  }

  /** Assert the desktop version is currently rendered. */
  async expectDesktopVersion() {
    await expect(this.versionSwitcher).toBeAttached({ timeout: SWITCH_TIMEOUT });
    await expect(this.switchToDesktopLink).toHaveCount(0);
  }
}

export default ManotoHomePage;
