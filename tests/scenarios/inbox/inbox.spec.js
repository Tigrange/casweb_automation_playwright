// Inbox tests.
//
//   INBOX [01]  inbox flow -> opens the inbox for the logged-in player.
//                              If the partner's inbox exposes the send composer
//                              (admin-configurable), it sends a message with an
//                              attachment, verifies it appears, then deletes it
//                              and verifies it is gone. Otherwise it only
//                              asserts that the inbox opened successfully.
//
// Reuses the authenticated storage state captured by the auth setup (never logs
// in), resolved per project device exactly like the login/change-password specs.

import { join } from 'node:path';
import { test } from '#src/fixtures/base.js';
import { getInboxPage } from '#src/factories/inboxRegistry.js';
import { getRuntimeConfig } from '#src/config/index.js';
import { requireStorageStatePath } from '#src/config/storageState.js';

const { envName, partnerId, partner } = getRuntimeConfig();

/** Shared PNG fixture (1x1) â€” the inbox uploader accepts images only. */
const ATTACHMENT_PATH = join(process.cwd(), 'tests', 'data', 'fixtures', 'inbox-attachment.png');
const ATTACHMENT_NAME = 'inbox-attachment.png';

/** Resolve the device from the active project's metadata. */
function deviceOf(testInfo) {
  return testInfo.project.metadata.authDevice ?? 'desktop';
}

test.use({
  storageState: async ({}, use, testInfo) => {
    await use(requireStorageStatePath(envName, partnerId, deviceOf(testInfo)));
  },
});

test.describe('INBOX [01]: inbox message flow', () => {
  test(
    `INBOX [01] inbox flow - ${partner.displayName}`,
    { tag: ['@positive', '@smoke'] },
    async ({ runtime, page }) => {
      const inbox = getInboxPage(page, runtime.partnerId);
      await page.goto(runtime.baseURL, { waitUntil: 'domcontentloaded' });

      await inbox.open();

      if (!(await inbox.isSendAvailable())) {
        // Send is not enabled for this partner from the admin side: opening the
        // inbox successfully is the whole covered behaviour.
        return;
      }

      const subject = `Automation inbox ${Date.now()}`;
      const message = 'Hello from automation';

      await inbox.createMessage({ subject, message, attachmentPath: ATTACHMENT_PATH });
      await inbox.expectMessageCreated({ subject, message, attachmentName: ATTACHMENT_NAME });
      await inbox.deleteMessage(subject);
    },
  );
});
