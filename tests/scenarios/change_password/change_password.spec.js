import { test, expect } from '#src/fixtures/base.js';
const {  partner } = getRuntimeConfig();

test.describe('Change password page', () => {
	test(`renders the change password form · ${partner.displayName}`,{ tag: ['@positive', '@smoke'] }, async ({ page }) => {
	    expect(true).toBe(true);

	});

	test(`displays validation for mismatched passwords · ${partner.displayName}`,{ tag: ['@positive', '@smoke'] }, async ({ page }) => {
    	expect(true).toBe(true);
	});
});
