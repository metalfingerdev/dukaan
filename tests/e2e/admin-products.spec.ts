/**
 * The admin adds a category and a product with a photo, restocks it, and customers see it until
 * the category is hidden. Products and categories can't be deleted, so the test leaves its
 * category and product behind, hidden, on the dev deployment.
 */
import { expect, test } from '@playwright/test';
import { hasRole, skipReason, statePath } from './env';

test.skip(!hasRole('admin'), skipReason('admin'));

// A 1x1 PNG: the page shrinks and uploads whatever image it is given
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
	'base64'
);

test('a new product reaches the storefront, can be restocked, and hides with its category', async ({
	browser
}) => {
	const stamp = Date.now().toString(36);
	const category = `E2E category ${stamp}`;
	const token = `e2eitem${stamp}`;
	const name = `${token} test item`;

	const adminContext = await browser.newContext({ storageState: statePath('admin') });
	const admin = await adminContext.newPage();
	const visitorContext = await browser.newContext();
	const visitor = await visitorContext.newPage();

	try {
		await admin.goto('/admin/categories');
		await admin.getByLabel('Category name').fill(category);
		await admin.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(admin.getByText(category, { exact: true })).toBeVisible();

		await admin.goto('/admin/products/new');
		await admin.getByLabel(/^Name/).fill(name);
		await admin.getByLabel('Pack size').fill('250 g');
		await admin.getByLabel(/^Category/).selectOption({ label: category });
		await admin.getByLabel('Selling price (₹)').fill('45');
		await admin.getByLabel('MRP (₹)').fill('50.50');
		await admin.getByLabel('Stock on the shelf now').fill('3');
		await admin
			.getByLabel('Choose a photo')
			.setInputFiles({ name: 'item.png', mimeType: 'image/png', buffer: PNG });
		await admin.getByRole('button', { name: 'Add product' }).click();
		await expect(admin).toHaveURL(/\/admin\/products\/[^/]+$/);
		await expect(admin.getByRole('heading', { name: 'Edit product' })).toBeVisible();
		await expect(admin.locator('fieldset img')).toBeVisible();

		// Restock from the list: the history shows the opening stock and the new delivery
		await admin.goto('/admin/products');
		await admin.getByLabel(/^Category/).selectOption({ label: category });
		await admin.getByRole('button', { name: `Stock: ${name}` }).click();
		await admin.getByLabel('How many').fill('5');
		await admin.getByRole('button', { name: 'Received' }).click();
		await expect(admin.getByText('Stock updated.')).toBeVisible();
		await expect(admin.getByText('+5 → 8')).toBeVisible();
		await expect(admin.getByText('+3 → 3')).toBeVisible();

		await visitor.goto(`/search?q=${token}`);
		await expect(visitor.getByRole('link', { name })).toBeVisible();

		await admin.goto('/admin/categories');
		await admin.getByRole('button', { name: `Hide: ${category}` }).click();
		await expect(admin.getByRole('button', { name: `Show: ${category}` })).toBeVisible();

		await visitor.goto(`/search?q=${token}`);
		await expect(visitor.getByRole('link', { name })).toHaveCount(0);
	} finally {
		// Leave nothing visible to customers even if the test failed halfway
		await admin.goto('/admin/categories');
		const hide = admin.getByRole('button', { name: `Hide: ${category}` });
		if (await hide.isVisible().catch(() => false)) await hide.click();
		await adminContext.close();
		await visitorContext.close();
	}
});
