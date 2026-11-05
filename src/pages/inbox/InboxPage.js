// Inbox page object (base / main class).
//
// Selectors use stable test hooks only: element ids and JS behaviour classes
// (classes whose name contains "js", e.g. .js_msg_item, .js_delete_msg).
// No styling classes (primary-btn, inbox-popup, inbox_v2, ...).
//
// Subclasses for partners whose DOM differs live next to this file and are
// registered in src/factories/inboxRegistry.js.

import { expect } from '@playwright/test';
import { BasePage } from '../BasePage.js';

/** Date tolerance for "added date is correct" (+/- 20 minutes). */
const CREATED_AT_TOLERANCE_MS = 20 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse the inbox date format "04 Nov, 2026 17:37" into a Date.
 * @param {string} text
 * @returns {Date|null}
 */
function parseSiteDate(text) {
  const match = /(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})/.exec(String(text || '').trim());
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].slice(0, 1).toUpperCase() + match[2].slice(1, 3).toLowerCase());
  if (month === -1) return null;
  const [, day, , year, hour, minute] = match;
  return new Date(Number(year), month, Number(day), Number(hour), Number(minute), 0);
}

export class InboxPage extends BasePage {
  get selectors() {
    return {
      accountMenuTrigger: {
        desktop: '#js_nav_right_toggle_btn', // unused; guard prevents clicking on desktop
        mobile: '#js_nav_right_toggle_btn',
      },
      openTrigger: {
        desktop: '.inboxDialog',
        mobile: '.cw_mob_right_sidebar a[href*="/account/inbox"]',
      },
      container: {
        desktop: '#js_msgs_cont',
        mobile: '#js_msgs_cont',
      },
      newMessage: { desktop: '#newmessage_btn', mobile: 'a[href*="newMsg=true"]' },
      subject: { desktop: '#send_subject', mobile: '#send_subject' },
      message: { desktop: '#send_message', mobile: '.tl_mail_send_area' },
      file: { desktop: '#file_upload', mobile: '#file_upload' },
      send: { desktop: '#send_btn', mobile: '#send_btn' },
      items: { desktop: '.js_msg_item', mobile: '.js_msg_item' },
      deleteIcon: { desktop: '.js_delete_msg', mobile: '.js_delete_msg' },
      messageSubject: { desktop: '.js_subject_detail', mobile: '.js_subject_detail' },
      messageDate: { desktop: '.js_last_update_time', mobile: '.js_last_update_time' },
      // Detail pane (composer when composing, message body when a row is opened).
      detailArea: { desktop: '#msg_cont', mobile: '#msg_cont' },
    };
  }

  constructor(page) {
    super(page);
    this.accountMenuTrigger = this.sel('accountMenuTrigger').first();
    this.openTrigger = this.sel('openTrigger').first();
    this.container = this.sel('container').first();
    this.newMessageButton = this.sel('newMessage').first();
    this.subjectInput = this.sel('subject').first();
    this.messageInput = this.sel('message').first();
    this.fileInput = this.sel('file').first();
    this.sendButton = this.sel('send').first();
    this.items = this.sel('items');
    this.deleteIcon = this.sel('deleteIcon');
    this.messageSubject = this.sel('messageSubject');
    this.messageDate = this.sel('messageDate');
    this.detailArea = this.sel('detailArea').first();
  }

  /** Open the inbox: click the header trigger when present, else go to the page. */
  async open() {
    if (this.device === 'mobile') {
      await this.accountMenuTrigger.evaluate((el) => el.click());
    }
    await this.openTrigger.evaluate((el) => el.click());
    await expect(this.container).toBeVisible();
  }

  /** @returns {Promise<boolean>} whether the send composer is available. */
  async isSendAvailable() {
    return this.newMessageButton.isVisible().catch(() => false);
  }

  /**
   * Create a message.
   * @param {{ subject: string, message: string, attachmentPath?: string }} params
   */
  async createMessage({ subject, message, attachmentPath }) {
    await this.newMessageButton.evaluate((el) => el.click());
    await this.subjectInput.fill(subject);
    await this.messageInput.fill(message);
    if (attachmentPath) {
      await this.fileInput.setInputFiles(attachmentPath);
    }
    await this.sendButton.evaluate((el) => el.click());
  }

  /**
   * Assert the created message.
   * Desktop: the new row in #js_msgs_cont shows the subject and an added date
   * within +/- 20 minutes; the detail pane (#msg_cont) then shows subject,
   * description and attachment file name.
   * Mobile: only that a new row was added to #js_msgs_cont.
   *
   * @param {{ subject: string, message: string, attachmentName?: string }} params
   */
  async expectMessageCreated({ subject, message, attachmentName }) {
    const row = this.items.filter({ hasText: subject }).first();
    await expect(row).toBeVisible();

    if (this.device === 'mobile') return;

    await expect(row).toContainText(subject);
    const dateText = await row.locator('.js_last_update_time').first().innerText();
    const createdAt = parseSiteDate(dateText);
    expect(createdAt, `unparsable inbox date: "${dateText}"`).not.toBeNull();
    expect(Math.abs(Date.now() - createdAt.getTime())).toBeLessThanOrEqual(CREATED_AT_TOLERANCE_MS);

    await row.locator('.js_subject_detail').first().evaluate((el) => el.click());
    await expect(this.detailArea).toContainText(subject);
    await expect(this.detailArea).toContainText(message);
    if (attachmentName) {
      await expect(this.detailArea).toContainText(attachmentName);
    }
  }

  /** Delete the message with the given subject. */
  async deleteMessage(subject) {
    const item = this.items.filter({ hasText: subject }).first();
    await item.locator('.js_delete_msg').first().evaluate((el) => el.click());
  }
}

export default InboxPage;
