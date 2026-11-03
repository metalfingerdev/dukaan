import { describe, expect, it } from 'vitest';
import { internal } from '../_generated/api';
import { DEMO_PRODUCTS } from '../model/store/demoCatalog';
import { setupStore } from './harness.testutils';

describe('seedDemo', () => {
	it('does not overwrite settings someone already edited', async () => {
		const { t } = await setupStore({ seed: false });
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
	it('refuses once an order exists', async () => {
		const { t } = await setupStore({ seed: false });
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
