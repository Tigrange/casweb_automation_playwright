import { test, expect } from '#src/fixtures/base.js';
import { resolveRuntimeConfig } from '#src/config/index.js';
const { partner } = await resolveRuntimeConfig();

test(`dummy lobby page test · ${partner.displayName}`,{ tag: ['@positive', '@smoke'] }, async () => {
	expect(true).toBe(true);
});
