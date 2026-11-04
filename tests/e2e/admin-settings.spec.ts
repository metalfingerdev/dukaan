/**
 * What the admin saves in /admin/settings is what customers get: delivery areas in the address
 * form, the delivery fee in the cart bill, and the open/closed switch at checkout. Everything it
 * changes is put back at the end.
 */
import { expect, test } from '@playwright/test';
import { hasRole, skipReason, statePath } from './env';
import { addFromCategory, clearCart, openAdminSettings, saveSettings } from './store';

test.skip(!hasRole('admin') || !hasRole('customer'), `${skipReason('admin')}; also needs a customer`);

const TEST_AREA = 'E2E test area';

test('settings reach the customer, and the switch stops checkout', async ({ browser }) => {
	const admin = await openAdminSettings(browser);
	const areas = admin.page.getByLabel(/One area per line/);
	const fee = admin.page.getByLabel('Delivery fee', { exact: true });
	const before = { areas: await areas.inputValue(), fee: await fee.inputValue() };
	const wasSwitchedOff = await admin.page.getByRole('button', { name: 'Open the store' }).isVisible();
	if (wasSwitchedOff) await admin.page.getByRole('button', { name: 'Open the store' }).click();

	const customerContext = await browser.newContext({ storageState: statePath('customer') });
	const customer = await customerContext.newPage();

	try {
		await areas.fill(`${before.areas}\n${TEST_AREA}`);
		await fee.fill('21.50');
		await saveSettings(admin.page);

		await customer.goto('/account/addresses');
		await customer.getByRole('button', { name: 'Add an address' }).click();
		await expect(customer.getByLabel('Area').locator('option', { hasText: TEST_AREA })).toHaveCount(1);

		await clearCart(customer);
		await addFromCategory(customer, 'dairy-eggs', ['Paneer']);
		await customer.goto('/cart');
		await expect(customer.getByText('₹21.50')).toBeVisible();

		await admin.page.getByRole('button', { name: 'Close the store now' }).click();
		await expect(admin.page.getByRole('button', { name: 'Open the store' })).toBeVisible();
		await customer.goto('/checkout');
		await expect(customer.getByText("We're closed right now, so we can't take orders.")).toBeVisible();
		await expect(customer.getByRole('button', { name: /^Place order/ })).toBeDisabled();
	} finally {
		await admin.page.goto('/admin/settings');
		const reopen = admin.page.getByRole('button', { name: 'Open the store' });
		if (!wasSwitchedOff && (await reopen.isVisible())) await reopen.click();
		await admin.page.getByLabel(/One area per line/).fill(before.areas);
		await admin.page.getByLabel('Delivery fee', { exact: true }).fill(before.fee);
		await saveSettings(admin.page);
		await clearCart(customer);
		await customerContext.close();
		await admin.context.close();
	}
});
