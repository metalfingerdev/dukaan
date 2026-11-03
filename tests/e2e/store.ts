/** Steps several specs share. They drive the real pages, never the database. */
import { expect, type Browser, type Page } from '@playwright/test';
import { statePath } from './env';

/** Empties the signed-in customer's cart through the cart page */
export async function clearCart(page: Page) {
	await page.goto('/cart');
	const empty = page.getByText('Your cart is empty.');
	const removeOne = page.getByRole('button', { name: 'Remove one' });
	const remove = page.getByRole('button', { name: 'Remove', exact: true });
	for (let i = 0; i < 100; i++) {
		await expect(empty.or(removeOne.first()).or(remove.first())).toBeVisible();
		if (await empty.isVisible()) return;
		const button = (await remove.count()) > 0 ? remove.first() : removeOne.first();
		// The button is disabled while the previous change saves, and the line can vanish mid-click
		await button.click({ timeout: 5_000 }).catch(() => {});
	}
	throw new Error('The cart did not empty');
}

/** Adds one of each named product from a category page */
export async function addFromCategory(page: Page, categorySlug: string, names: string[]) {
	await page.goto(`/c/${categorySlug}`);
	for (const name of names) {
		const card = page.getByRole('listitem').filter({ has: page.getByRole('link', { name }) });
		await card.getByRole('button', { name: 'Add' }).click();
		await expect(card.getByRole('button', { name: 'Remove one' })).toBeVisible();
	}
}

/** The admin's settings page, signed in */
export async function openAdminSettings(browser: Browser) {
	const context = await browser.newContext({ storageState: statePath('admin') });
	const page = await context.newPage();
	await page.goto('/admin/settings');
	await expect(page.getByLabel('Opens at')).toBeVisible();
	return { context, page };
}

export async function saveSettings(page: Page) {
	await page.getByRole('button', { name: 'Save settings' }).click();
	await expect(page.getByText('Settings saved.')).toBeVisible();
}

/**
 * Makes sure customers can check out whatever the time: hours 00:00 to 23:59 and the switch on.
 * Returns a function that puts the previous hours and switch back.
 */
export async function openAllDay(browser: Browser) {
	const { context, page } = await openAdminSettings(browser);
	const opens = page.getByLabel('Opens at');
	const closes = page.getByLabel('Closes at');
	const before = { opens: await opens.inputValue(), closes: await closes.inputValue() };
	const wasSwitchedOff = await page.getByRole('button', { name: 'Open the store' }).isVisible();

	await opens.fill('00:00');
	await closes.fill('23:59');
	await saveSettings(page);
	if (wasSwitchedOff) await page.getByRole('button', { name: 'Open the store' }).click();

	return async () => {
		await page.goto('/admin/settings');
		await page.getByLabel('Opens at').fill(before.opens);
		await page.getByLabel('Closes at').fill(before.closes);
		await saveSettings(page);
		if (wasSwitchedOff) await page.getByRole('button', { name: 'Close the store now' }).click();
		await context.close();
	};
}
