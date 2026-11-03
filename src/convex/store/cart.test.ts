/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';
import { api, internal } from '../_generated/api';
import schema from '../schema';

// The real guard reads the user through the Better Auth component, which convex-test doesn't
// mount. This stand-in does what the guard promises (signed out is refused; the user id comes from
// the session, never from an argument) so the cart logic, ownership and refusals can be tested.
// The real guard is a one-line wrapper over authComponent.getAuthUser.
vi.mock('../model/store/access', () => ({
	requireCustomer: async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new ConvexError('Not authenticated');
		return { _id: identity.subject };
	}
}));

// See seed.test.ts for why the patterns are anchored at the project root
const modules = import.meta.glob([
	'/src/convex/_generated/*.js',
	'/src/convex/store/*.ts',
	'/src/convex/model/store/*.ts',
	'!/src/convex/**/*.test.ts'
]);

const setup = async () => {
	const t = convexTest(schema, modules);
	await t.mutation(internal.store.seed.seedDemo, {});
	return {
		t,
		alice: t.withIdentity({ subject: 'alice' }),
		bob: t.withIdentity({ subject: 'bob' })
	};
};

type T = Awaited<ReturnType<typeof setup>>['t'];

const idOf = (t: T, slug: string) =>
	t.run(async (ctx) => {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		return product!._id;
	});

const patchProduct = (t: T, slug: string, fields: Record<string, unknown>) =>
	t.run(async (ctx) => {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		await ctx.db.patch(product!._id, fields);
	});

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

	it('reports a sold-out product and removes its stale line', async () => {
		const { t, alice } = await setup();
		const productId = await idOf(t, 'curd-400g');
		await alice.mutation(api.store.cart.setQuantity, { productId, quantity: 2 });
		await patchProduct(t, 'curd-400g', { stock: 0 });
		await expect(alice.mutation(api.store.cart.setQuantity, { productId, quantity: 2 })).resolves.toEqual({
			quantity: 0,
			status: 'out_of_stock'
		});
		expect(await alice.query(api.store.cart.getCart, {})).toHaveLength(0);
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

	it('stops at 100 different products', async () => {
		const { t, alice } = await setup();
		const first = await idOf(t, 'tomato-500g');
		const extra = await t.run(async (ctx) => {
			const template = await ctx.db.get(first);
			const { _id, _creationTime, ...fields } = template!;
			void _id;
			void _creationTime;
			const ids = [];
			for (let i = 0; i < 100; i++) {
				ids.push(await ctx.db.insert('products', { ...fields, slug: `bulk-${i}`, name: `Bulk ${i}` }));
			}
			return ids;
		});
		for (const productId of extra) {
			await alice.mutation(api.store.cart.setQuantity, { productId, quantity: 1 });
		}
		await expect(alice.mutation(api.store.cart.setQuantity, { productId: first, quantity: 1 })).rejects.toThrow(
			/CART_FULL/
		);
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

describe('getCart', () => {
	it('returns the public product projection only, and skips hidden products', async () => {
		const { t, alice } = await setup();
		const milk = await idOf(t, 'toned-milk-500ml');
		const butter = await idOf(t, 'butter-100g');
		await alice.mutation(api.store.cart.setQuantity, { productId: milk, quantity: 2 });
		// Put a hidden product straight into the table, as if hidden after it was added
		await t.run((ctx) => ctx.db.insert('cartItems', { userId: 'alice', productId: butter, quantity: 1 }));
		await patchProduct(t, 'butter-100g', { isActive: false });

		const cart = await alice.query(api.store.cart.getCart, {});
		expect(cart.map((line) => line.product.slug)).toEqual(['toned-milk-500ml']);
		for (const field of ['stock', 'lowStockAt', 'maxPerOrder', 'isActive', 'gstRatePercent', 'hsn']) {
			expect(cart[0].product).not.toHaveProperty(field);
		}
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

	it('keeps the larger quantity when both carts have the product', async () => {
		const { t, alice } = await setup();
		const milk = await idOf(t, 'toned-milk-500ml');
		const eggs = await idOf(t, 'eggs-6pc');
		await alice.mutation(api.store.cart.setQuantity, { productId: milk, quantity: 3 });
		await alice.mutation(api.store.cart.setQuantity, { productId: eggs, quantity: 1 });
		await alice.mutation(api.store.cart.mergeGuestCart, {
			lines: [
				{ productId: milk, quantity: 1 },
				{ productId: eggs, quantity: 4 }
			]
		});
		const cart = await alice.query(api.store.cart.getCart, {});
		expect(Object.fromEntries(cart.map((l) => [l.product.slug, l.quantity]))).toEqual({
			'toned-milk-500ml': 3,
			'eggs-6pc': 4
		});
	});

	it('clamps to what is available', async () => {
		const { t, alice } = await setup();
		const apple = await idOf(t, 'apple-4pc'); // stock 3
		await alice.mutation(api.store.cart.mergeGuestCart, { lines: [{ productId: apple, quantity: 50 }] });
		expect((await alice.query(api.store.cart.getCart, {}))[0].quantity).toBe(3);
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

	it('ignores repeated product ids within one request', async () => {
		const { t, alice } = await setup();
		const milk = await idOf(t, 'toned-milk-500ml');
		await alice.mutation(api.store.cart.mergeGuestCart, {
			lines: [
				{ productId: milk, quantity: 2 },
				{ productId: milk, quantity: 4 }
			]
		});
		expect((await alice.query(api.store.cart.getCart, {}))[0].quantity).toBe(2);
	});

	it('refuses more than 50 lines', async () => {
		const { alice } = await setup();
		const lines = Array.from({ length: 51 }, (_, i) => ({ productId: `id${i}`, quantity: 1 }));
		await expect(alice.mutation(api.store.cart.mergeGuestCart, { lines })).rejects.toThrow(/TOO_MANY_LINES/);
	});

	it("does not touch another customer's cart", async () => {
		const { t, alice, bob } = await setup();
		const milk = await idOf(t, 'toned-milk-500ml');
		await bob.mutation(api.store.cart.setQuantity, { productId: milk, quantity: 1 });
		await alice.mutation(api.store.cart.mergeGuestCart, { lines: [{ productId: milk, quantity: 5 }] });
		expect((await bob.query(api.store.cart.getCart, {}))[0].quantity).toBe(1);
	});
});
