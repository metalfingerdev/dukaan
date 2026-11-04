/**
 * Who may open what. The route check in hooks.server.ts and each page's client-side redirect are
 * UX; the Convex functions behind them are the security boundary (tested in Vitest). This proves
 * the pages behave: browsing is open, everything else sends a visitor to sign in and back.
 */
import { expect, test } from '@playwright/test';
import { hasRole, skipReason, statePath } from './env';

const PUBLIC_PAGES = ['/', '/cart', '/search?q=milk', '/c/dairy-eggs', '/p/toned-milk-500ml'];
const PRIVATE_PAGES = ['/checkout', '/orders', '/account/addresses', '/admin', '/admin/settings', '/admin/users', '/delivery'];

test.describe('signed out', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('can browse the shop', async ({ page }) => {
		for (const path of PUBLIC_PAGES) {
			await page.goto(path);
			expect(new URL(page.url()).pathname, path).not.toBe('/signin');
		}
		await page.goto('/p/toned-milk-500ml');
		await expect(page.getByRole('heading', { name: 'Toned Milk' })).toBeVisible();
	});

	test('is sent to sign in, and back to the page afterwards', async ({ page }) => {
		for (const path of PRIVATE_PAGES) {
			await page.goto(path);
			await page.waitForURL(/\/signin/);
			expect(new URL(page.url()).searchParams.get('redirectTo'), path).toBe(path);
		}
	});
});

test.describe('customer', () => {
	test.skip(!hasRole('customer'), skipReason('customer'));
	test.use({ storageState: statePath('customer') });

	test('is refused the admin area and sees no admin link', async ({ page }) => {
		for (const path of ['/admin', '/admin/settings', '/admin/users']) {
			await page.goto(path);
			await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
		}
		await page.goto('/delivery');
		await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
		await page.goto('/');
		await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Deliveries' })).toHaveCount(0);
	});
});

test.describe('admin', () => {
	test.skip(!hasRole('admin'), skipReason('admin'));
	test.use({ storageState: statePath('admin') });

	test('reaches every admin page from the header', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Admin' }).click();
		await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
		await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click();
		await expect(page.getByRole('heading', { name: 'Store settings' })).toBeVisible();
		await page.getByRole('navigation').getByRole('link', { name: 'Users' }).click();
		await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
	});
});
