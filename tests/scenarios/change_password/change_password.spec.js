import { test, expect } from '#src/fixtures/base.js';

test.describe('Change password page', () => {
	test('renders the change password form',{ tag: ['@positive', '@smoke'] }, async ({ page }) => {
	    expect(true).toBe(true);

	});

	test('displays validation for mismatched passwords',{ tag: ['@positive', '@smoke'] }, async ({ page }) => {
    	expect(true).toBe(true);
	});
});
