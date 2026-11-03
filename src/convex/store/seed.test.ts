/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { internal } from '../_generated/api';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../model/store/demoCatalog';
import schema from '../schema';

// Only what these tests call, anchored at the project root. A broad glob would also pick up
// betterAuth/_generated, and convex-test takes the first path containing "_generated" as the
// functions root. Relative patterns break too: from store/, "../store/x.ts" is rewritten to "./x.ts".
const modules = import.meta.glob([
	'/src/convex/_generated/*.js',
	'/src/convex/store/*.ts',
	'/src/convex/model/store/*.ts',
	'!/src/convex/**/*.test.ts'
]);

describe('seedDemo', () => {
	it('loads settings, categories and products', async () => {
		const t = convexTest(schema, modules);
		const result = await t.mutation(internal.store.seed.seedDemo, {});
		expect(result).toEqual({
			settingsAdded: true,
			categoriesAdded: DEMO_CATEGORIES.length,
			productsAdded: DEMO_PRODUCTS.length
		});

		await t.run(async (ctx) => {
			expect(await ctx.db.query('storeSettings').collect()).toHaveLength(1);
			const categories = await ctx.db
				.query('categories')
				.withIndex('by_isActive_and_sortOrder', (q) => q.eq('isActive', true))
				.collect();
			expect(categories.map((c) => c.slug)).toEqual(DEMO_CATEGORIES.map((c) => c.slug));
			expect(await ctx.db.query('products').collect()).toHaveLength(DEMO_PRODUCTS.length);
		});
	});

	it('is safe to run twice', async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.store.seed.seedDemo, {});
		const second = await t.mutation(internal.store.seed.seedDemo, {});
		expect(second).toEqual({ settingsAdded: false, categoriesAdded: 0, productsAdded: 0 });
		await t.run(async (ctx) => {
			expect(await ctx.db.query('storeSettings').collect()).toHaveLength(1);
			expect(await ctx.db.query('products').collect()).toHaveLength(DEMO_PRODUCTS.length);
		});
	});

	it('does not overwrite settings someone already edited', async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.store.seed.seedDemo, {});
		await t.run(async (ctx) => {
			const settings = await ctx.db.query('storeSettings').first();
			await ctx.db.patch(settings!._id, { etaMinutes: 45, isOpen: false });
		});
		await t.mutation(internal.store.seed.seedDemo, {});
		await t.run(async (ctx) => {
			const settings = await ctx.db.query('storeSettings').first();
			expect(settings).toMatchObject({ etaMinutes: 45, isOpen: false });
		});
	});
});

describe('removeDemo', () => {
	it('removes the demo catalogue and keeps the settings', async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.store.seed.seedDemo, {});
		const result = await t.mutation(internal.store.seed.removeDemo, {});
		expect(result).toEqual({
			categoriesRemoved: DEMO_CATEGORIES.length,
			productsRemoved: DEMO_PRODUCTS.length
		});
		await t.run(async (ctx) => {
			expect(await ctx.db.query('products').collect()).toHaveLength(0);
			expect(await ctx.db.query('categories').collect()).toHaveLength(0);
			expect(await ctx.db.query('storeSettings').collect()).toHaveLength(1);
		});
	});

	it('clears signed-in cart lines that pointed at removed products', async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.store.seed.seedDemo, {});
		await t.run(async (ctx) => {
			const product = await ctx.db.query('products').first();
			await ctx.db.insert('cartItems', { userId: 'user_1', productId: product!._id, quantity: 2 });
		});
		await t.mutation(internal.store.seed.removeDemo, {});
		await t.run(async (ctx) => {
			expect(await ctx.db.query('cartItems').collect()).toHaveLength(0);
		});
	});

	it('refuses once an order exists', async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.store.seed.seedDemo, {});
		await t.run(async (ctx) => {
			await ctx.db.insert('orders', {
				orderNumber: 1,
				userId: 'user_1',
				idempotencyKey: 'key-1',
				status: 'placed',
				paymentMethod: 'cod',
				paymentStatus: 'pending',
				subtotalPaise: 10000,
				savingsPaise: 0,
				deliveryFeePaise: 0,
				smallCartFeePaise: 0,
				totalPaise: 10000,
				address: {
					kind: 'house',
					line1: 'Test house',
					area: 'Test area',
					contactName: 'Test',
					contactPhone: '+919999999999'
				},
				deliveryCode: '1234'
			});
		});
		await expect(t.mutation(internal.store.seed.removeDemo, {})).rejects.toThrow(/Orders exist/);
		await t.run(async (ctx) => {
			expect(await ctx.db.query('products').collect()).toHaveLength(DEMO_PRODUCTS.length);
		});
	});
});
