import { describe, expect, it } from 'vitest';
import { api } from '../_generated/api';
import { idOf, patchProduct, setupStore as setup } from './harness.testutils';

describe('signed out', () => {
	it('is refused on every cart function', async () => {
		const { t } = await setup();
		const productId = await idOf(t, 'tomato-500g');
		await expect(t.query(api.store.cart.getCart, {})).rejects.toThrow(/Not authenticated/);
		await expect(t.mutation(api.store.cart.setQuantity, { productId, quantity: 1 })).rejects.toThrow(
			/Not authenticated/
		);
		await expect(
			t.mutation(api.store.cart.mergeGuestCart, { lines: [{ productId, quantity: 1 }] })
		).rejects.toThrow(/Not authenticated/);
	});
});

describe('setQuantity', () => {
	it('adds, updates and removes a line', async () => {
		const { t, alice } = await setup();
		const productId = await idOf(t, 'tomato-500g');
		await expect(alice.mutation(api.store.cart.setQuantity, { productId, quantity: 2 })).resolves.toEqual({
			quantity: 2,
			status: 'ok'
		});
		await alice.mutation(api.store.cart.setQuantity, { productId, quantity: 4 });
		let cart = await alice.query(api.store.cart.getCart, {});
		expect(cart).toHaveLength(1);
		expect(cart[0]).toMatchObject({ productId, quantity: 4 });

		await expect(alice.mutation(api.store.cart.setQuantity, { productId, quantity: 0 })).resolves.toEqual({
			quantity: 0,
			status: 'ok'
		});
		cart = await alice.query(api.store.cart.getCart, {});
		expect(cart).toHaveLength(0);
	});

	it('clamps to the smaller of stock and the per-order limit', async () => {
		const { t, alice } = await setup();
		// maxPerOrder 5, stock 40: capped by the order limit
		const tomato = await idOf(t, 'tomato-500g');
		await expect(alice.mutation(api.store.cart.setQuantity, { productId: tomato, quantity: 9 })).resolves.toEqual({
			quantity: 5,
			status: 'clamped'
		});
		// stock 3, maxPerOrder 5: capped by stock
		const apple = await idOf(t, 'apple-4pc');
		await expect(alice.mutation(api.store.cart.setQuantity, { productId: apple, quantity: 5 })).resolves.toEqual({
			quantity: 3,
			status: 'clamped'
		});
	});

	it('refuses a hidden product but lets the line be removed', async () => {
		const { t, alice } = await setup();
		const productId = await idOf(t, 'paneer-200g');
		await alice.mutation(api.store.cart.setQuantity, { productId, quantity: 1 });
		await patchProduct(t, 'paneer-200g', { isActive: false });
		await expect(alice.mutation(api.store.cart.setQuantity, { productId, quantity: 1 })).resolves.toEqual({
			quantity: 0,
			status: 'unavailable'
		});
		expect(await alice.query(api.store.cart.getCart, {})).toHaveLength(0);
	});

	it('rejects quantities that are not whole non-negative numbers', async () => {
		const { t, alice } = await setup();
		const productId = await idOf(t, 'tomato-500g');
		for (const quantity of [-1, 1.5, Number.NaN]) {
			await expect(alice.mutation(api.store.cart.setQuantity, { productId, quantity })).rejects.toThrow();
		}
	});

});

describe('ownership', () => {
	it("keeps one customer's cart away from another", async () => {
		const { t, alice, bob } = await setup();
		const productId = await idOf(t, 'tomato-500g');
		await alice.mutation(api.store.cart.setQuantity, { productId, quantity: 3 });
		expect(await bob.query(api.store.cart.getCart, {})).toHaveLength(0);

		// Bob changing "his" tomato line must not touch Alice's
		await bob.mutation(api.store.cart.setQuantity, { productId, quantity: 1 });
		await bob.mutation(api.store.cart.setQuantity, { productId, quantity: 0 });
		const cart = await alice.query(api.store.cart.getCart, {});
		expect(cart).toHaveLength(1);
		expect(cart[0].quantity).toBe(3);
	});
});

describe('mergeGuestCart', () => {
	it('adds the guest lines to an empty cart', async () => {
		const { t, alice } = await setup();
		const milk = await idOf(t, 'toned-milk-500ml');
		const eggs = await idOf(t, 'eggs-6pc');
		await expect(
			alice.mutation(api.store.cart.mergeGuestCart, {
				lines: [
					{ productId: milk, quantity: 2 },
					{ productId: eggs, quantity: 1 }
				]
			})
		).resolves.toEqual({ merged: 2 });
		const cart = await alice.query(api.store.cart.getCart, {});
		expect(Object.fromEntries(cart.map((l) => [l.product.slug, l.quantity]))).toEqual({
			'toned-milk-500ml': 2,
			'eggs-6pc': 1
		});
	});

	it('is idempotent: repeating the same lines never doubles anything', async () => {
		const { t, alice } = await setup();
		const milk = await idOf(t, 'toned-milk-500ml');
		const lines = [{ productId: milk, quantity: 2 }];
		await alice.mutation(api.store.cart.mergeGuestCart, { lines });
		await expect(alice.mutation(api.store.cart.mergeGuestCart, { lines })).resolves.toEqual({ merged: 0 });
		await alice.mutation(api.store.cart.mergeGuestCart, { lines });
		const cart = await alice.query(api.store.cart.getCart, {});
		expect(cart).toHaveLength(1);
		expect(cart[0].quantity).toBe(2);
	});

	it('skips malformed, unknown, hidden, sold-out and empty lines instead of failing', async () => {
		const { t, alice } = await setup();
		const milk = await idOf(t, 'toned-milk-500ml');
		const butter = await idOf(t, 'butter-100g'); // stock 0
		const paneer = await idOf(t, 'paneer-200g');
		await patchProduct(t, 'paneer-200g', { isActive: false });
		const result = await alice.mutation(api.store.cart.mergeGuestCart, {
			lines: [
				{ productId: 'not-an-id', quantity: 1 },
				{ productId: '', quantity: 1 },
				{ productId: butter, quantity: 1 },
				{ productId: paneer, quantity: 1 },
				{ productId: milk, quantity: 0 },
				{ productId: milk, quantity: -2 },
				{ productId: milk, quantity: 1.5 },
				{ productId: milk, quantity: 2 }
			]
		});
		// Only the last milk line is valid; the invalid milk lines before it must not shadow it
		expect(result).toEqual({ merged: 1 });
		const cart = await alice.query(api.store.cart.getCart, {});
		expect(cart.map((l) => [l.product.slug, l.quantity])).toEqual([['toned-milk-500ml', 2]]);
	});

});
