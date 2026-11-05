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

  /** Delete the message with the given subject. */
  async deleteMessage(subject) {
    const item = this.items.filter({ hasText: subject }).first();
    await item.locator('.js_delete_msg').first().evaluate((el) => el.click());
  }
}

export default InboxPage;
