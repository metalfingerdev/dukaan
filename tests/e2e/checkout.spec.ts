/**
 * The customer's whole path on real pages: category, cart, checkout, the order with its delivery
 * code, and cancelling it (which also leaves the dev data as it was).
 *
 * Needs the store open. With an admin test account the spec opens it all day and restores the
 * hours afterwards; without one it runs only during the dev deployment's opening hours.
 */
import { expect, test, type Page } from '@playwright/test';
import { hasRole, skipReason, statePath } from './env';
import { addFromCategory, clearCart, openAllDay } from './store';

test.skip(!hasRole('customer'), skipReason('customer'));
// The pin is required: the browser "stands" at a fixed spot in Madhya Pradesh
test.use({
	storageState: statePath('customer'),
	permissions: ['geolocation'],
	geolocation: { latitude: 23.2, longitude: 77.4 }
});

/** Sets the pin on the open address form, with the map when a Maps key is set, else the location */
const setPin = async (page: Page) => {
	const usePin = page.getByRole('button', { name: 'Use this pin' });
	if (await usePin.isVisible()) {
		await expect(usePin).toBeEnabled();
		await usePin.click();
	} else {
		await page.getByRole('button', { name: 'Use my current location' }).click();
	}
	await expect(page.getByText('Pin saved.')).toBeVisible();
};

let restoreHours: (() => Promise<void>) | undefined;
test.beforeAll(async ({ browser }) => {
	if (hasRole('admin')) restoreHours = await openAllDay(browser);
});
test.afterAll(async () => {
	await restoreHours?.();
});

test('order, see the delivery code, cancel', async ({ page }) => {
	await clearCart(page);
	// ₹85 + ₹48: above the placeholder minimum order, below free delivery
	await addFromCategory(page, 'dairy-eggs', ['Paneer', 'Eggs']);

	await page.getByRole('link', { name: /View cart/ }).click();
	await expect(page.getByText('Item total')).toBeVisible();
	await page.getByRole('link', { name: 'Checkout' }).click();
	await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

	// The closed notice and the button render together once the page has loaded the store's hours
	await expect(page.getByRole('button', { name: /^Place order/ })).toBeVisible();
	if (await page.getByText("We're closed right now, so we can't take orders.").isVisible()) {
		await clearCart(page);
		test.skip(true, 'The dev store is closed now and there is no admin test account to open it');
	}

	// Use a saved address, or add one in the first delivery area
	const saved = page.getByRole('radio', { name: /.+/ }).and(page.locator('input[name=address]'));
	if ((await saved.count()) > 0) {
		await saved.first().check();
		// An address saved before pins were required must get one before the order
		if (await page.getByRole('button', { name: 'Add the pin' }).isVisible()) {
			await page.getByRole('button', { name: 'Add the pin' }).click();
			await setPin(page);
			await page.getByRole('button', { name: 'Save address' }).click();
		}
	} else {
		await page.getByRole('button', { name: 'Add a new address' }).click();
		await setPin(page);
		await page.getByLabel('Name this address').fill('E2E home');
		await page.getByLabel('House or flat number and street').fill('E2E test house');
		await page.getByLabel('Area').selectOption({ index: 1 });
		await page.getByRole('button', { name: 'Save address' }).click();
	}

	await page.getByRole('radio', { name: 'Cash on delivery' }).check();
	await page.getByRole('button', { name: /^Place order/ }).click();

	await page.waitForURL(/\/orders\/[^/]+$/);
	await expect(page.getByText('Order placed').first()).toBeVisible();
	await expect(page.getByLabel('Delivery code')).toHaveText(/^\s*\d{4}\s*$/);

	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Cancel order' }).click();
	await expect(page.getByText('This order was cancelled.')).toBeVisible();
	await expect(page.getByLabel('Delivery code')).toHaveCount(0);
});
