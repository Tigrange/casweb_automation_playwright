// Inbox tests (two TestRail cases per device).
//
//   INBOX [01]  inbox message WITHOUT attachment
//               open inbox -> send a plain message -> verify it appears.
//               TestRail: web C27456 / mobile C27487
//   INBOX [02]  inbox message WITH attachment
//               open inbox -> send a message with inbox-attachment.png ->
//               verify it appears (including the attachment name).
//               TestRail: web C27457 / mobile C27488
//
// If the partner's inbox exposes no send composer (admin-configurable), the
// case is SKIPPED with a reason -> TestRail shows it as Blocked.
//
// Message DELETION is intentionally NOT part of the flow anymore (QA decision
// 2026-11-26): the cases only send + verify. The deleteMessage call is kept
// commented below for future use.
//
// Reuses the authenticated storage state captured by the auth setup (never logs
// in), resolved per project device exactly like the login/change-password specs.

import { join } from 'node:path';
import { test } from '#src/fixtures/base.js';
import { getInboxPage } from '#src/factories/inboxRegistry.js';
import { resolveRuntimeConfig } from '#src/config/index.js';
import { requireStorageStatePath } from '#src/config/storageState.js';
import { attachTestRailCaseId } from '#support/testrail.js';

const { envName, partnerId, partner } = await resolveRuntimeConfig();

/** Shared PNG fixture (1x1) — the inbox uploader accepts images only. */
const ATTACHMENT_PATH = join(process.cwd(), 'tests', 'data', 'fixtures', 'inbox-attachment.png');
const ATTACHMENT_NAME = 'inbox-attachment.png';

/** TestRail case IDs per device (separate web/mobile cases). */
const TESTRAIL_NO_ATTACHMENT = { web: 'C27456', mobile: 'C27487' };
const TESTRAIL_WITH_ATTACHMENT = { web: 'C27457', mobile: 'C27488' };

/** Resolve the device from the active project's metadata. */
function deviceOf(testInfo) {
  return testInfo.project.metadata.authDevice ?? 'desktop';
}

test.use({
  storageState: async ({}, use, testInfo) => {
    // Attach the case ID BEFORE setup: a setup failure (missing session,
    // Cloudflare) must still be reported to TestRail.
    const ids = /with attachment/i.test(testInfo.title)
      ? TESTRAIL_WITH_ATTACHMENT
      : TESTRAIL_NO_ATTACHMENT;
    attachTestRailCaseId(testInfo, ids);
    await use(requireStorageStatePath(envName, partnerId, deviceOf(testInfo)));
  },
});

test.describe('INBOX [01]: inbox message (no attachment)', () => {
  test(
    `INBOX [01] inbox message without attachment · ${partner.displayName}`,
    { tag: ['@positive', '@smoke'] },
    async ({ runtime, page }) => {
      const inbox = getInboxPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });

      await inbox.open();

      if (!(await inbox.isSendAvailable())) {
        test.skip(true, 'send message(inbox) not enabled for this partner');
      }

      const subject = `Automation inbox ${Date.now()}`;
      const message = 'Hello from automation';

      await inbox.createMessage({ subject, message });
      await inbox.expectMessageCreated({ subject, message });

      // [2026-11-26] Message deletion removed from the flow per QA decision —
      // the case only sends + verifies. Kept here for future use:
      // await inbox.deleteMessage(subject);
    },
  );
});

test.describe('INBOX [02]: inbox message with attachment', () => {
  test(
    `INBOX [02] inbox message with attachment · ${partner.displayName}`,
    { tag: ['@positive', '@smoke'] },
    async ({ runtime, page }) => {
      const inbox = getInboxPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });

      await inbox.open();

      if (!(await inbox.isSendAvailable())) {
        test.skip(true, 'send message(inbox) not enabled for this partner');
      }

      const subject = `Automation inbox ${Date.now()}`;
      const message = 'Hello from automation';

      await inbox.createMessage({ subject, message, attachmentPath: ATTACHMENT_PATH });
      await inbox.expectMessageCreated({ subject, message, attachmentName: ATTACHMENT_NAME });

      // [2026-11-26] Message deletion removed from the flow per QA decision —
      // the case only sends + verifies. Kept here for future use:
      // await inbox.deleteMessage(subject);
    },
  );
});
