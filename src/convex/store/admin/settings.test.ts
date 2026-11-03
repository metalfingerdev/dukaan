/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../_generated/api';
import { STORE_SETTINGS_DEFAULTS } from '../../model/store/storeProfile';
import schema from '../../schema';

// Stand-ins for the real guards, which need the Better Auth component (see cart.test.ts). The
// identity with subject "admin" is the store admin; any other signed-in identity is a customer.
type Ctx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };
vi.mock('../../model/store/access', () => ({
	requireCustomer: async (ctx: Ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new ConvexError('Not authenticated');
		return { _id: identity.subject };
	},
	requireAppAdmin: async (ctx: Ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new ConvexError('Not authenticated');
		if (identity.subject !== 'admin') throw new ConvexError('Forbidden: application admin role required');
		return { _id: identity.subject };
	}
}));

// See seed.test.ts for why the patterns are anchored at the project root
const modules = import.meta.glob([
	'/src/convex/_generated/*.js',
	'/src/convex/store/*.ts',
	'/src/convex/store/admin/*.ts',
	'/src/convex/model/store/*.ts',
	'/src/convex/otp/phone.ts',
	'!/src/convex/**/*.test.ts'
]);

const { getSettings, updateSettings, setStoreOpen } = api.store.admin.settings;

const setup = async () => {
	const t = convexTest(schema, modules);
	await t.mutation(internal.store.seed.seedDemo, {});
	return {
		t,
		admin: t.withIdentity({ subject: 'admin' }),
		alice: t.withIdentity({ subject: 'alice' })
	};
};

const form = {
	opensAtMinute: 8 * 60,
	closesAtMinute: 22 * 60,
	etaMinutes: 20,
	deliveryAreas: ['Govt College', ' Boys Hostel '],
	minOrderPaise: 5000,
	deliveryFeePaise: 1500,
	freeDeliveryAbovePaise: 20000,
	smallCartFeePaise: 500,
	smallCartBelowPaise: 10000,
	storePhone: '098765 43210',
	upiVpa: 'Shop.Name@OKAxis'
};

describe('access', () => {
	it('refuses signed-out visitors and customers, and changes nothing', async () => {
		const { t, alice } = await setup();
		for (const caller of [t, alice]) {
			await expect(caller.query(getSettings, {})).rejects.toThrow(/Not authenticated|Forbidden/);
			await expect(caller.mutation(updateSettings, form)).rejects.toThrow(/Not authenticated|Forbidden/);
			await expect(caller.mutation(setStoreOpen, { isOpen: false })).rejects.toThrow(
				/Not authenticated|Forbidden/
			);
		}
		const info = await t.query(api.store.catalog.getStoreInfo, {});
		expect(info).toMatchObject({
			isOpen: true,
			deliveryFeePaise: STORE_SETTINGS_DEFAULTS.deliveryFeePaise,
			deliveryAreas: STORE_SETTINGS_DEFAULTS.deliveryAreas
		});
	});
});

describe('updateSettings', () => {
	it('changes what customers see and which areas they can deliver to', async () => {
		const { t, admin, alice } = await setup();
		const saved = await admin.mutation(updateSettings, form);
		expect(saved).toMatchObject({
			storePhone: '+919876543210',
			upiVpa: 'shop.name@okaxis',
			deliveryAreas: ['Govt College', 'Boys Hostel']
		});

		const info = await t.query(api.store.catalog.getStoreInfo, {});
		expect(info).toMatchObject({
			opensAtMinute: 8 * 60,
			etaMinutes: 20,
			deliveryFeePaise: 1500,
			storePhone: '+919876543210',
			deliveryAreas: ['Govt College', 'Boys Hostel']
		});

		const address = {
			label: 'Home',
			kind: 'house' as const,
			line1: '12, Test Street',
			contactName: 'Test Customer',
			contactPhone: '9876543210'
		};
		await expect(
			alice.mutation(api.store.addresses.saveAddress, { ...address, area: STORE_SETTINGS_DEFAULTS.deliveryAreas[0] })
		).rejects.toThrow(/OUT_OF_AREA/);
		await alice.mutation(api.store.addresses.saveAddress, { ...address, area: 'Boys Hostel' });
	});
});
