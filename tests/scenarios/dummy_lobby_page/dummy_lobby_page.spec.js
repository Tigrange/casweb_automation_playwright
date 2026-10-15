import { test, expect } from '#src/fixtures/base.js';
const { partner } = getRuntimeConfig();

test(`dummy lobby page test · ${partner.displayName}`,{ tag: ['@positive', '@smoke'] }, async () => {
	expect(true).toBe(true);
});
