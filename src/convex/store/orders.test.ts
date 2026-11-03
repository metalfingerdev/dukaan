/// <reference types="vite/client" />
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../_generated/api';
import { listSlots } from '../model/store/slots';
import { transitionOrder } from '../model/store/orderStatus';
import schema from '../schema';

// Stand-in for the real guard, which needs the Better Auth component; see cart.test.ts
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
	'/src/convex/otp/phone.ts',
	'!/src/convex/**/*.test.ts'
]);

// 12:00 IST on 3 Nov 2026: inside the placeholder opening hours (09:00-21:00)
const NOON_IST = Date.UTC(2026, 10, 3, 6, 30);
const LATE_NIGHT_IST = Date.UTC(2026, 10, 3, 17, 30); // 23:00 IST

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOON_IST);
});
afterEach(() => vi.useRealTimers());

const setup = async () => {
	const t = convexTest(schema, modules);
	rateLimiterTest.register(t);
	await t.mutation(internal.store.seed.seedDemo, {});
	return { t, alice: t.withIdentity({ subject: 'alice' }), bob: t.withIdentity({ subject: 'bob' }) };
};
type Setup = Awaited<ReturnType<typeof setup>>;
type Client = Setup['alice'];

/** The data of the ConvexError a call throws; fails if it doesn't throw one */
const failure = async (call: Promise<unknown>) => {
	try {
		await call;
	} catch (error) {
		if (error instanceof ConvexError) return error.data as { code: string; [key: string]: unknown };
		throw error;
	}
	throw new Error('expected the call to throw a ConvexError');
};

const idOf = (t: Setup['t'], slug: string) =>
	t.run(async (ctx) => {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		return product!._id;
	});

const patchProduct = (t: Setup['t'], slug: string, fields: Record<string, unknown>) =>
	t.run(async (ctx) => {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		await ctx.db.patch(product!._id, fields);
	});

const stockOf = (t: Setup['t'], slug: string) =>
	t.run(async (ctx) => {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		return product!.stock;
	});

const addToCart = async (t: Setup['t'], client: Client, slug: string, quantity: number) => {
	const productId = await idOf(t, slug);
	await client.mutation(api.store.cart.setQuantity, { productId, quantity });
};

const saveAddress = async (client: Client, overrides: Record<string, unknown> = {}) =>
	(
		await client.mutation(api.store.addresses.saveAddress, {
			label: 'Home',
			kind: 'house',
			line1: '12, Test Street',
			area: 'Main Market (placeholder)',
			contactName: 'Test Customer',
			contactPhone: '9876543210',
			...overrides
		})
	).addressId;

// tomato 2 x 25.00 + milk 3 x 29.00 = 137.00; below Rs 299 so delivery 20.00; above Rs 99 so no handling fee
const BASKET_TOTAL = 15_700;
const fillBasket = async (t: Setup['t'], client: Client) => {
	await addToCart(t, client, 'tomato-500g', 2);
	await addToCart(t, client, 'toned-milk-500ml', 3);
};

let keyCounter = 0;
const orderArgs = (
	addressId: Awaited<ReturnType<typeof saveAddress>>,
	overrides: Record<string, unknown> = {}
) => ({
	addressId,
	paymentMethod: 'cod' as const,
	idempotencyKey: `test-key-${++keyCounter}-abcdef`,
	expectedTotalPaise: BASKET_TOTAL,
	...overrides
});

/** Row counts and stock, to prove a failed order left nothing behind */
const snapshot = (t: Setup['t']) =>
	t.run(async (ctx) => ({
		orders: (await ctx.db.query('orders').collect()).length,
		orderItems: (await ctx.db.query('orderItems').collect()).length,
		orderEvents: (await ctx.db.query('orderEvents').collect()).length,
		adjustments: (await ctx.db.query('stockAdjustments').collect()).length,
		counters: (await ctx.db.query('counters').collect()).length,
		cart: (await ctx.db.query('cartItems').collect()).map((l) => `${l.userId}:${l.productId}:${l.quantity}`).sort(),
		stock: Object.fromEntries((await ctx.db.query('products').collect()).map((p) => [p.slug, p.stock]))
	}));

describe('signed out', () => {
	it('is refused on every order function', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		await expect(t.mutation(api.store.orders.placeOrder, orderArgs(addressId))).rejects.toThrow(
			/Not authenticated/
		);
		await expect(t.mutation(api.store.orders.cancelOrder, { orderId: 'x' })).rejects.toThrow(
			/Not authenticated/
		);
		await expect(t.query(api.store.orders.getOrder, { orderId: 'x' })).rejects.toThrow(/Not authenticated/);
		await expect(
			t.query(api.store.orders.listMyOrders, { paginationOpts: { numItems: 5, cursor: null } })
		).rejects.toThrow(/Not authenticated/);
	});
});

describe('placeOrder: the happy path', () => {
	it('creates the order, snapshots, event and stock movements, and clears the cart', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice, { landmark: 'near the temple', lat: 23.2, lng: 77.4 });
		const tomatoBefore = await stockOf(t, 'tomato-500g');
		const milkBefore = await stockOf(t, 'toned-milk-500ml');

		const placed = await alice.mutation(
			api.store.orders.placeOrder,
			orderArgs(addressId, { note: '  call at the gate ', paymentMethod: 'upi_on_delivery' })
		);
		expect(placed).toMatchObject({ orderNumber: 1, alreadyPlaced: false });

		await t.run(async (ctx) => {
			const order = (await ctx.db.get(placed.orderId))!;
			expect(order).toMatchObject({
				userId: 'alice',
				orderNumber: 1,
				status: 'placed',
				paymentMethod: 'upi_on_delivery',
				paymentStatus: 'pending',
				subtotalPaise: 13_700,
				savingsPaise: 2 * 500 + 3 * 100, // MRP 30 vs 25, and 30 vs 29
				deliveryFeePaise: 2_000,
				smallCartFeePaise: 0,
				totalPaise: BASKET_TOTAL,
				customerNote: 'call at the gate'
			});
			expect(order.deliveryCode).toMatch(/^\d{4}$/);
			expect(order.slotStartMs).toBeUndefined(); // as soon as possible
			// the address is a snapshot of what was saved
			expect(order.address).toEqual({
				kind: 'house',
				line1: '12, Test Street',
				area: 'Main Market (placeholder)',
				landmark: 'near the temple',
				contactName: 'Test Customer',
				contactPhone: '+919876543210',
				lat: 23.2,
				lng: 77.4
			});

			const items = await ctx.db.query('orderItems').collect();
			expect(items.map((i) => [i.name, i.unitPricePaise, i.mrpPaise, i.quantity]).sort()).toEqual([
				['Tomato', 2500, 3000, 2],
				['Toned Milk', 2900, 3000, 3]
			]);

			const events = await ctx.db.query('orderEvents').collect();
			expect(events).toHaveLength(1);
			expect(events[0]).toMatchObject({ orderId: order._id, status: 'placed', actorKind: 'customer', actorId: 'alice' });

			const adjustments = await ctx.db.query('stockAdjustments').collect();
			expect(adjustments.map((a) => [a.delta, a.reason, a.orderId, a.actorId]).sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
				[-3, 'sold', order._id, 'alice'],
				[-2, 'sold', order._id, 'alice']
			]);
			expect(await ctx.db.query('cartItems').collect()).toHaveLength(0);
		});
		expect(await stockOf(t, 'tomato-500g')).toBe(tomatoBefore - 2);
		expect(await stockOf(t, 'toned-milk-500ml')).toBe(milkBefore - 3);
	});

	it('records stockAfter on each adjustment', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		await alice.mutation(api.store.orders.placeOrder, orderArgs(addressId));
		await t.run(async (ctx) => {
			for (const adjustment of await ctx.db.query('stockAdjustments').collect()) {
				const product = (await ctx.db.get(adjustment.productId))!;
				expect(adjustment.stockAfter).toBe(product.stock);
			}
		});
	});

	it('numbers orders one after another', async () => {
		const { t, alice, bob } = await setup();
		const results = [];
		for (const client of [alice, bob, alice]) {
			await fillBasket(t, client);
			const addressId = await saveAddress(client);
			results.push((await client.mutation(api.store.orders.placeOrder, orderArgs(addressId))).orderNumber);
		}
		expect(results).toEqual([1, 2, 3]);
	});

	it('accepts a valid slot and stores it', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		const settings = await t.run((ctx) => ctx.db.query('storeSettings').first());
		const [slot] = listSlots(settings!, NOON_IST);
		const placed = await alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { slotStartMs: slot }));
		const order = await t.run((ctx) => ctx.db.get(placed.orderId));
		expect(order!.slotStartMs).toBe(slot);
	});
});

describe('placeOrder: idempotency', () => {
	it('returns the same order for a retry and decrements stock only once', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		const args = orderArgs(addressId);
		const first = await alice.mutation(api.store.orders.placeOrder, args);
		const stockAfterFirst = await stockOf(t, 'tomato-500g');

		const retry = await alice.mutation(api.store.orders.placeOrder, args);
		expect(retry).toEqual({ ...first, alreadyPlaced: true });
		expect(await stockOf(t, 'tomato-500g')).toBe(stockAfterFirst);
		expect((await snapshot(t)).orders).toBe(1);
	});

	it('does not touch a refilled cart on a retry', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		const args = orderArgs(addressId);
		await alice.mutation(api.store.orders.placeOrder, args);
		await addToCart(t, alice, 'eggs-6pc', 1);
		await alice.mutation(api.store.orders.placeOrder, args);
		expect((await snapshot(t)).cart).toHaveLength(1);
	});

	it("keeps one customer's key from returning another customer's order", async () => {
		const { t, alice, bob } = await setup();
		await fillBasket(t, alice);
		await fillBasket(t, bob);
		const args = orderArgs(await saveAddress(alice));
		await alice.mutation(api.store.orders.placeOrder, args);
		const bobAddress = await saveAddress(bob);
		const bobOrder = await bob.mutation(api.store.orders.placeOrder, { ...args, addressId: bobAddress });
		expect(bobOrder.alreadyPlaced).toBe(false);
		expect((await snapshot(t)).orders).toBe(2);
	});

	it('refuses a key that is too short or too long', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		for (const idempotencyKey of ['short', 'x'.repeat(65)]) {
			expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { idempotencyKey })))).code).toBe(
				'INVALID_IDEMPOTENCY_KEY'
			);
		}
	});
});

describe('placeOrder: money', () => {
	it('refuses when the total the customer saw is out of date, and says what it is now', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		await patchProduct(t, 'tomato-500g', { pricePaise: 3000, mrpPaise: 3000 }); // +5.00 each, x2
		const before = await snapshot(t);

		const error = await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId)));
		expect(error).toEqual({ code: 'PRICE_CHANGED', totalPaise: BASKET_TOTAL + 1_000 });
		expect(await snapshot(t)).toEqual(before);

		// accepting the new total works
		const placed = await alice.mutation(
			api.store.orders.placeOrder,
			orderArgs(addressId, { expectedTotalPaise: BASKET_TOTAL + 1_000 })
		);
		expect(placed.alreadyPlaced).toBe(false);
	});

	it('cannot be underpaid by sending a smaller expected total', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		for (const expectedTotalPaise of [0, 1, BASKET_TOTAL - 1, BASKET_TOTAL + 1]) {
			expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { expectedTotalPaise })))).code).toBe(
				'PRICE_CHANGED'
			);
		}
		expect((await snapshot(t)).orders).toBe(0);
	});

	it('charges the database price, whatever the browser believes', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		const placed = await alice.mutation(api.store.orders.placeOrder, orderArgs(addressId));
		const order = await t.run((ctx) => ctx.db.get(placed.orderId));
		expect(order!.totalPaise).toBe(BASKET_TOTAL);
	});

	it('refuses an order below the minimum, and charges a handling fee only between the two thresholds', async () => {
		const { t, alice } = await setup();
		await addToCart(t, alice, 'instant-noodles-70g', 1); // Rs 14, below the Rs 99 minimum
		const addressId = await saveAddress(alice);
		const error = await failure(
			alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { expectedTotalPaise: 1_400 + 2_000 + 1_000 }))
		);
		expect(error).toEqual({ code: 'BELOW_MINIMUM', minOrderPaise: 9_900 });
		expect((await snapshot(t)).orders).toBe(0);
	});

	it('is free of delivery fees from the threshold up', async () => {
		const { t, alice } = await setup();
		await addToCart(t, alice, 'wheat-atta-5kg', 2); // Rs 470
		const addressId = await saveAddress(alice);
		const placed = await alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { expectedTotalPaise: 47_000 }));
		const order = await t.run((ctx) => ctx.db.get(placed.orderId));
		expect(order).toMatchObject({ deliveryFeePaise: 0, smallCartFeePaise: 0, totalPaise: 47_000 });
	});
});

describe('placeOrder: stock', () => {
	it('gives the last unit to the first customer and tells the second what changed', async () => {
		const { t, alice, bob } = await setup();
		await patchProduct(t, 'wheat-atta-5kg', { stock: 1 });
		for (const client of [alice, bob]) await addToCart(t, client, 'wheat-atta-5kg', 1);
		const aliceAddress = await saveAddress(alice);
		const bobAddress = await saveAddress(bob);
		const args = { expectedTotalPaise: 25_500 }; // Rs 235 atta + Rs 20 delivery (below the Rs 299 threshold)

		await alice.mutation(api.store.orders.placeOrder, orderArgs(aliceAddress, args));
		expect(await stockOf(t, 'wheat-atta-5kg')).toBe(0);

		const productId = await idOf(t, 'wheat-atta-5kg');
		const error = await failure(bob.mutation(api.store.orders.placeOrder, orderArgs(bobAddress, args)));
		expect(error).toEqual({
			code: 'CART_CHANGED',
			problems: [{ productId, reason: 'out_of_stock', available: 0 }]
		});
		const state = await snapshot(t);
		expect(state.orders).toBe(1);
		expect(state.stock['wheat-atta-5kg']).toBe(0);
		expect(state.cart).toEqual([`bob:${productId}:1`]); // Bob's cart is untouched
	});

	it('rolls everything back when a line fails partway through', async () => {
		const { t, alice } = await setup();
		// Two cart rows for one product with stock for only one of them: each passes the early check,
		// the second stock change then fails after the first one and the order rows were written
		await patchProduct(t, 'wheat-atta-5kg', { stock: 1 });
		const productId = await idOf(t, 'wheat-atta-5kg');
		await t.run(async (ctx) => {
			await ctx.db.insert('cartItems', { userId: 'alice', productId, quantity: 1 });
			await ctx.db.insert('cartItems', { userId: 'alice', productId, quantity: 1 });
		});
		const addressId = await saveAddress(alice);
		const before = await snapshot(t);

		const error = await failure(
			alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { expectedTotalPaise: 47_000 }))
		);
		expect(error.code).toBe('OUT_OF_STOCK');
		expect(await snapshot(t)).toEqual(before); // no order, items, event, adjustment, counter; stock and cart as they were
	});

	it('reports every problem line at once', async () => {
		const { t, alice } = await setup();
		await addToCart(t, alice, 'tomato-500g', 2);
		await addToCart(t, alice, 'toned-milk-500ml', 3);
		await addToCart(t, alice, 'eggs-6pc', 2);
		await patchProduct(t, 'tomato-500g', { isActive: false });
		await patchProduct(t, 'toned-milk-500ml', { stock: 1 });
		await patchProduct(t, 'eggs-6pc', { maxPerOrder: 1 });
		const addressId = await saveAddress(alice);

		const error = await failure(
			alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { expectedTotalPaise: 1 }))
		);
		expect(error.code).toBe('CART_CHANGED');
		const problems = error.problems as { productId: string; reason: string; available: number }[];
		const bySlug = Object.fromEntries(
			await Promise.all(
				problems.map(async (p) => {
					const slug = await t.run(async (ctx) => (await ctx.db.get(p.productId as never) as { slug: string }).slug);
					return [slug, [p.reason, p.available]];
				})
			)
		);
		expect(bySlug).toEqual({
			'tomato-500g': ['unavailable', 0],
			'toned-milk-500ml': ['out_of_stock', 1],
			'eggs-6pc': ['over_limit', 1]
		});
	});
});

describe('placeOrder: everything else that can refuse', () => {
	it('refuses an empty cart', async () => {
		const { alice } = await setup();
		const addressId = await saveAddress(alice);
		expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId)))).code).toBe('EMPTY_CART');
	});

	it('refuses while the store is closed, by the switch or by the clock', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);

		vi.setSystemTime(LATE_NIGHT_IST);
		expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId)))).code).toBe('STORE_CLOSED');

		vi.setSystemTime(NOON_IST);
		await t.run(async (ctx) => {
			const settings = await ctx.db.query('storeSettings').first();
			await ctx.db.patch(settings!._id, { isOpen: false });
		});
		expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId)))).code).toBe('STORE_CLOSED');
		expect((await snapshot(t)).orders).toBe(0);
	});

	it("refuses an address that isn't the customer's, with the same answer as for a missing one", async () => {
		const { t, alice, bob } = await setup();
		await fillBasket(t, bob);
		const aliceAddress = await saveAddress(alice);
		expect((await failure(bob.mutation(api.store.orders.placeOrder, orderArgs(aliceAddress)))).code).toBe(
			'ADDRESS_NOT_FOUND'
		);
		const gone = await saveAddress(bob);
		await bob.mutation(api.store.addresses.deleteAddress, { id: gone });
		expect((await failure(bob.mutation(api.store.orders.placeOrder, orderArgs(gone)))).code).toBe('ADDRESS_NOT_FOUND');
	});

	it('refuses an address whose area the store no longer delivers to', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		await t.mutation(internal.store.seed.setDeliveryAreas, { areas: ['Somewhere else'] });
		expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId)))).code).toBe('OUT_OF_AREA');
	});

	it('refuses a slot that is not on offer', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		for (const slotStartMs of [NOON_IST, NOON_IST + 60 * 60 * 1000 + 1, NOON_IST - 3_600_000, 42]) {
			expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { slotStartMs })))).code).toBe(
				'INVALID_SLOT'
			);
		}
	});

	it('refuses a note that is too long', async () => {
		const { t, alice } = await setup();
		await fillBasket(t, alice);
		const addressId = await saveAddress(alice);
		expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId, { note: 'x'.repeat(301) })))).code).toBe(
			'INVALID_NOTE'
		);
	});

	it('refuses a fourth open order, and allows one again after a cancellation', async () => {
		const { t, alice } = await setup();
		const addressId = await saveAddress(alice);
		const orderIds = [];
		for (let i = 0; i < 3; i++) {
			await fillBasket(t, alice);
			orderIds.push((await alice.mutation(api.store.orders.placeOrder, orderArgs(addressId))).orderId);
		}
		await fillBasket(t, alice);
		expect((await failure(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId)))).code).toBe(
			'TOO_MANY_OPEN_ORDERS'
		);
		await alice.mutation(api.store.orders.cancelOrder, { orderId: orderIds[0] });
		await expect(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId))).resolves.toMatchObject({
			alreadyPlaced: false
		});
	});

	it('limits how many orders one customer can place in an hour', async () => {
		const { t, alice } = await setup();
		const addressId = await saveAddress(alice);
		for (let i = 0; i < 10; i++) {
			await fillBasket(t, alice);
			const { orderId } = await alice.mutation(api.store.orders.placeOrder, orderArgs(addressId));
			await alice.mutation(api.store.orders.cancelOrder, { orderId }); // keeps the open-order limit out of the way
		}
		await fillBasket(t, alice);
		await expect(alice.mutation(api.store.orders.placeOrder, orderArgs(addressId))).rejects.toThrow(/RateLimited/);
		// a different customer is not affected
		const bob = t.withIdentity({ subject: 'bob' });
		await fillBasket(t, bob);
		await expect(
			bob.mutation(api.store.orders.placeOrder, orderArgs(await saveAddress(bob)))
		).resolves.toMatchObject({ alreadyPlaced: false });
	});
});

describe('cancelOrder', () => {
	const placeBasket = async (s: Setup) => {
		await fillBasket(s.t, s.alice);
		const addressId = await saveAddress(s.alice);
		return (await s.alice.mutation(api.store.orders.placeOrder, orderArgs(addressId))).orderId;
	};

	it('cancels a placed order and puts the stock back', async () => {
		const s = await setup();
		const tomatoStart = await stockOf(s.t, 'tomato-500g');
		const orderId = await placeBasket(s);
		await expect(s.alice.mutation(api.store.orders.cancelOrder, { orderId })).resolves.toEqual({ status: 'cancelled' });

		expect(await stockOf(s.t, 'tomato-500g')).toBe(tomatoStart);
		await s.t.run(async (ctx) => {
			const order = (await ctx.db.get(orderId))!;
			expect(order.status).toBe('cancelled');
			const events = await ctx.db.query('orderEvents').collect();
			expect(events.map((e) => [e.status, e.actorKind])).toEqual([
				['placed', 'customer'],
				['cancelled', 'customer']
			]);
			const restores = (await ctx.db.query('stockAdjustments').collect()).filter((a) => a.reason === 'order_cancelled');
			expect(restores.map((a) => a.delta).sort()).toEqual([2, 3]);
		});
	});

	it('restores stock exactly once, however often it is called', async () => {
		const s = await setup();
		const start = await stockOf(s.t, 'toned-milk-500ml');
		const orderId = await placeBasket(s);
		for (let i = 0; i < 3; i++) await s.alice.mutation(api.store.orders.cancelOrder, { orderId });
		expect(await stockOf(s.t, 'toned-milk-500ml')).toBe(start);
		expect((await snapshot(s.t)).adjustments).toBe(4); // 2 sold + 2 restored
	});

	it("can't touch someone else's order, and a missing or malformed id looks the same", async () => {
		const s = await setup();
		const orderId = await placeBasket(s);
		const before = await snapshot(s.t);
		for (const id of [orderId, 'not-an-id', '']) {
			expect((await failure(s.bob.mutation(api.store.orders.cancelOrder, { orderId: id }))).code).toBe('ORDER_NOT_FOUND');
		}
		expect(await snapshot(s.t)).toEqual(before);
	});

	it('is refused once the store has accepted the order', async () => {
		const s = await setup();
		const orderId = await placeBasket(s);
		await s.t.run((ctx) =>
			transitionOrder(ctx, { orderId, to: 'accepted', actor: { kind: 'admin', id: 'admin1' } })
		);
		const before = await snapshot(s.t);
		expect(await failure(s.alice.mutation(api.store.orders.cancelOrder, { orderId }))).toEqual({
			code: 'CANNOT_CANCEL',
			status: 'accepted'
		});
		expect(await snapshot(s.t)).toEqual(before);
	});
});

describe('transitionOrder', () => {
	const placed = async () => {
		const s = await setup();
		await fillBasket(s.t, s.alice);
		const addressId = await saveAddress(s.alice);
		const { orderId } = await s.alice.mutation(api.store.orders.placeOrder, orderArgs(addressId));
		return { ...s, orderId };
	};
	const move = (s: Awaited<ReturnType<typeof placed>>, to: Parameters<typeof transitionOrder>[1]['to']) =>
		s.t.run((ctx) => transitionOrder(ctx, { orderId: s.orderId, to, actor: { kind: 'admin', id: 'admin1' } }));

	it('walks the happy path, writing an event for each step', async () => {
		const s = await placed();
		for (const to of ['accepted', 'packed', 'out_for_delivery', 'delivered'] as const) await move(s, to);
		await s.t.run(async (ctx) => {
			const order = (await ctx.db.get(s.orderId))!;
			expect(order.status).toBe('delivered');
			// the test clock nudges forward a millisecond per call, so compare loosely
			expect(order.deliveredAt).toBeGreaterThanOrEqual(NOON_IST);
			expect(order.deliveredAt).toBeLessThan(NOON_IST + 1000);
			expect((await ctx.db.query('orderEvents').collect()).map((e) => e.status)).toEqual([
				'placed',
				'accepted',
				'packed',
				'out_for_delivery',
				'delivered'
			]);
		});
	});

	it('refuses a move the state machine does not allow, and changes nothing', async () => {
		const s = await placed();
		const before = await snapshot(s.t);
		for (const to of ['packed', 'delivered', 'out_for_delivery', 'delivery_failed'] as const) {
			await expect(move(s, to), to).rejects.toThrow(/INVALID_TRANSITION/);
		}
		expect(await snapshot(s.t)).toEqual(before);
	});

	it('cannot be cancelled and delivered: both are final', async () => {
		const s = await placed();
		await move(s, 'cancelled');
		for (const to of ['delivered', 'accepted', 'cancelled'] as const) {
			await expect(move(s, to), to).rejects.toThrow(/INVALID_TRANSITION/);
		}
	});

	it('restores stock when a later-stage order is cancelled, and again never', async () => {
		const s = await placed();
		const start = (await stockOf(s.t, 'tomato-500g')) + 2; // before the order took 2
		for (const to of ['accepted', 'packed', 'cancelled'] as const) await move(s, to);
		expect(await stockOf(s.t, 'tomato-500g')).toBe(start);
		await expect(move(s, 'cancelled')).rejects.toThrow(/INVALID_TRANSITION/);
		expect(await stockOf(s.t, 'tomato-500g')).toBe(start);
	});

	it('restores stock when a failed delivery is cancelled, but not when it is tried again', async () => {
		const s = await placed();
		const start = (await stockOf(s.t, 'tomato-500g')) + 2;
		for (const to of ['accepted', 'packed', 'out_for_delivery', 'delivery_failed', 'packed'] as const) await move(s, to);
		expect(await stockOf(s.t, 'tomato-500g')).toBe(start - 2); // retry keeps the stock sold
		await move(s, 'cancelled');
		expect(await stockOf(s.t, 'tomato-500g')).toBe(start);
	});

	it('cannot cancel an order that is out for delivery', async () => {
		const s = await placed();
		for (const to of ['accepted', 'packed', 'out_for_delivery'] as const) await move(s, to);
		await expect(move(s, 'cancelled')).rejects.toThrow(/INVALID_TRANSITION/);
	});
});

describe('reading orders', () => {
	const KEYS = [
		'_id', 'address', 'customerNote', 'deliveredAt', 'deliveryCode', 'deliveryFeePaise', 'events', 'invoiceNumber',
		'items', 'orderNumber', 'paymentMethod', 'paymentStatus', 'placedAt', 'savingsPaise', 'slotStartMs',
		'smallCartFeePaise', 'status', 'subtotalPaise', 'totalPaise'
	];
	const PRIVATE = ['userId', 'idempotencyKey', 'assignedPartnerId', 'cashCollectedPaise', 'cashSettledAt', '_creationTime'];

	const placedOrder = async (s: Setup, client: Client = s.alice) => {
		await fillBasket(s.t, client);
		const addressId = await saveAddress(client);
		return (await client.mutation(api.store.orders.placeOrder, orderArgs(addressId))).orderId;
	};

	it("shows an order to its owner with items and timeline, and nobody else's", async () => {
		const s = await setup();
		const orderId = await placedOrder(s);
		const order = await s.alice.query(api.store.orders.getOrder, { orderId });
		expect(order).toMatchObject({ orderNumber: 1, status: 'placed', totalPaise: BASKET_TOTAL });
		expect(order!.items).toHaveLength(2);
		expect(order!.events.map((e) => e.status)).toEqual(['placed']);
		expect(order!.placedAt).toBeGreaterThanOrEqual(NOON_IST);
		expect(order!.placedAt).toBeLessThan(NOON_IST + 1000);

		for (const id of [orderId, 'not-an-id', '']) {
			await expect(s.bob.query(api.store.orders.getOrder, { orderId: id })).resolves.toBeNull();
		}
	});

	it('returns only the projection, with no internal fields', async () => {
		const s = await setup();
		const orderId = await placedOrder(s);
		const order = await s.alice.query(api.store.orders.getOrder, { orderId });
		for (const key of Object.keys(order!)) expect(KEYS, key).toContain(key);
		for (const field of PRIVATE) expect(order).not.toHaveProperty(field);
		expect(order!.address).not.toHaveProperty('lat');
	});

	it('shows the delivery code only while the order is open', async () => {
		const s = await setup();
		const orderId = await placedOrder(s);
		const code = await s.t.run(async (ctx) => (await ctx.db.get(orderId))!.deliveryCode);
		expect((await s.alice.query(api.store.orders.getOrder, { orderId }))!.deliveryCode).toBe(code);

		for (const to of ['accepted', 'packed', 'out_for_delivery'] as const) {
			await s.t.run((ctx) => transitionOrder(ctx, { orderId, to, actor: { kind: 'admin' } }));
			expect((await s.alice.query(api.store.orders.getOrder, { orderId }))!.deliveryCode).toBe(code);
		}
		await s.t.run((ctx) => transitionOrder(ctx, { orderId, to: 'delivered', actor: { kind: 'partner' } }));
		const delivered = await s.alice.query(api.store.orders.getOrder, { orderId });
		expect(delivered).not.toHaveProperty('deliveryCode');
		expect(delivered!.status).toBe('delivered');
	});

	it('hides the delivery code on a cancelled order', async () => {
		const s = await setup();
		const orderId = await placedOrder(s);
		await s.alice.mutation(api.store.orders.cancelOrder, { orderId });
		expect(await s.alice.query(api.store.orders.getOrder, { orderId })).not.toHaveProperty('deliveryCode');
	});

	it('lists only my orders, newest first, and pages through them', async () => {
		const s = await setup();
		const first = await placedOrder(s);
		await s.alice.mutation(api.store.orders.cancelOrder, { orderId: first });
		const second = await placedOrder(s);
		await placedOrder(s, s.bob);

		const page = await s.alice.query(api.store.orders.listMyOrders, { paginationOpts: { numItems: 10, cursor: null } });
		expect(page.page.map((o) => [o.orderNumber, o.status])).toEqual([
			[3 - 1, 'placed'], // alice's second order was number 2
			[1, 'cancelled']
		]);
		expect(page.page[0]._id).toBe(second);
		expect(page.isDone).toBe(true);

		const small = await s.alice.query(api.store.orders.listMyOrders, { paginationOpts: { numItems: 1, cursor: null } });
		expect(small.page).toHaveLength(1);
		expect(small.isDone).toBe(false);
		const rest = await s.alice.query(api.store.orders.listMyOrders, {
			paginationOpts: { numItems: 1, cursor: small.continueCursor }
		});
		expect(rest.page.map((o) => o.orderNumber)).toEqual([1]);

		const bobs = await s.bob.query(api.store.orders.listMyOrders, { paginationOpts: { numItems: 10, cursor: null } });
		expect(bobs.page.map((o) => o.orderNumber)).toEqual([3]);
	});
});
