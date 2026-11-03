/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';
import { api, internal } from '../_generated/api';
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

const setup = async () => {
	const t = convexTest(schema, modules);
	await t.mutation(internal.store.seed.seedDemo, {});
	return {
		t,
		alice: t.withIdentity({ subject: 'alice' }),
		bob: t.withIdentity({ subject: 'bob' })
	};
};

const home = {
	label: 'Home',
	kind: 'house' as const,
	line1: '12, Test Street',
	area: 'Main Market (placeholder)',
	contactName: 'Test Customer',
	contactPhone: '9876543210'
};

describe('signed out', () => {
	it('is refused on every address function', async () => {
		const { t, alice } = await setup();
		const { addressId } = await alice.mutation(api.store.addresses.saveAddress, home);
		await expect(t.query(api.store.addresses.listAddresses, {})).rejects.toThrow(/Not authenticated/);
		await expect(t.mutation(api.store.addresses.saveAddress, home)).rejects.toThrow(/Not authenticated/);
		await expect(t.mutation(api.store.addresses.deleteAddress, { id: addressId })).rejects.toThrow(
			/Not authenticated/
		);
		await expect(t.mutation(api.store.addresses.setDefaultAddress, { id: addressId })).rejects.toThrow(
			/Not authenticated/
		);
	});
});

describe('saveAddress', () => {
	it('saves a cleaned address with an E.164 phone, and makes the first one the default', async () => {
		const { alice } = await setup();
		await alice.mutation(api.store.addresses.saveAddress, { ...home, landmark: ' near the temple ' });
		const [saved] = await alice.query(api.store.addresses.listAddresses, {});
		expect(saved).toMatchObject({
			label: 'Home',
			contactPhone: '+919876543210',
			landmark: 'near the temple',
			isDefault: true
		});
		expect(saved).not.toHaveProperty('userId');
	});

	it('stores coordinates when given', async () => {
		const { alice } = await setup();
		await alice.mutation(api.store.addresses.saveAddress, { ...home, lat: 23.2, lng: 77.4 });
		const [saved] = await alice.query(api.store.addresses.listAddresses, {});
		expect(saved).toMatchObject({ lat: 23.2, lng: 77.4 });
	});

	it('refuses an area outside the delivery list and a bad phone', async () => {
		const { alice } = await setup();
		await expect(
			alice.mutation(api.store.addresses.saveAddress, { ...home, area: 'Somewhere else' })
		).rejects.toThrow(/OUT_OF_AREA/);
		await expect(
			alice.mutation(api.store.addresses.saveAddress, { ...home, contactPhone: '12345' })
		).rejects.toThrow(/INVALID_ADDRESS/);
		expect(await alice.query(api.store.addresses.listAddresses, {})).toHaveLength(0);
	});

	it('updates in place and really removes a cleared landmark and location', async () => {
		const { alice } = await setup();
		const { addressId } = await alice.mutation(api.store.addresses.saveAddress, {
			...home,
			landmark: 'old landmark',
			lat: 23.2,
			lng: 77.4
		});
		await alice.mutation(api.store.addresses.saveAddress, { ...home, id: addressId, line1: 'New line' });
		const list = await alice.query(api.store.addresses.listAddresses, {});
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ line1: 'New line', isDefault: true });
		expect(list[0].landmark).toBeUndefined();
		expect(list[0].lat).toBeUndefined();
	});

	it('moves the default when asked, keeping exactly one', async () => {
		const { alice } = await setup();
		await alice.mutation(api.store.addresses.saveAddress, home);
		await alice.mutation(api.store.addresses.saveAddress, { ...home, label: 'Hostel', makeDefault: true });
		const list = await alice.query(api.store.addresses.listAddresses, {});
		expect(list.filter((a) => a.isDefault).map((a) => a.label)).toEqual(['Hostel']);
		expect(list[0].label).toBe('Hostel'); // default first
	});

	it('stops at 10 addresses', async () => {
		const { alice } = await setup();
		for (let i = 0; i < 10; i++) {
			await alice.mutation(api.store.addresses.saveAddress, { ...home, label: `Place ${i}` });
		}
		await expect(alice.mutation(api.store.addresses.saveAddress, home)).rejects.toThrow(
			/TOO_MANY_ADDRESSES/
		);
	});

	it('refuses to save before the store is set up', async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.withIdentity({ subject: 'alice' }).mutation(api.store.addresses.saveAddress, home)
		).rejects.toThrow(/STORE_NOT_SET_UP/);
	});
});

describe('ownership', () => {
	it("hides one customer's addresses from another", async () => {
		const { alice, bob } = await setup();
		await alice.mutation(api.store.addresses.saveAddress, home);
		expect(await bob.query(api.store.addresses.listAddresses, {})).toHaveLength(0);
	});

	it("refuses to edit, delete or default another customer's address, with the same answer as for a missing one", async () => {
		const { t, alice, bob } = await setup();
		const { addressId } = await alice.mutation(api.store.addresses.saveAddress, home);
		const missing = await t.run(async (ctx) => {
			const id = await ctx.db.insert('addresses', {
				userId: 'someone', label: 'x', kind: 'house', line1: 'x', area: 'x',
				contactName: 'x', contactPhone: '+919876543210', isDefault: false
			});
			await ctx.db.delete(id);
			return id;
		});

		const attempts = [
			(id: typeof addressId) => bob.mutation(api.store.addresses.saveAddress, { ...home, id }),
			(id: typeof addressId) => bob.mutation(api.store.addresses.deleteAddress, { id }),
			(id: typeof addressId) => bob.mutation(api.store.addresses.setDefaultAddress, { id })
		];
		for (const attempt of attempts) {
			await expect(attempt(addressId)).rejects.toThrow(/ADDRESS_NOT_FOUND/);
			await expect(attempt(missing)).rejects.toThrow(/ADDRESS_NOT_FOUND/);
		}
		// Alice's address is untouched
		expect(await alice.query(api.store.addresses.listAddresses, {})).toHaveLength(1);
	});
});

describe('setDefaultAddress and deleteAddress', () => {
	it('switches the default', async () => {
		const { alice } = await setup();
		await alice.mutation(api.store.addresses.saveAddress, home);
		const { addressId } = await alice.mutation(api.store.addresses.saveAddress, { ...home, label: 'B' });
		await alice.mutation(api.store.addresses.setDefaultAddress, { id: addressId });
		const list = await alice.query(api.store.addresses.listAddresses, {});
		expect(list.filter((a) => a.isDefault).map((a) => a.label)).toEqual(['B']);
	});

	it('promotes the oldest remaining address when the default is deleted', async () => {
		const { alice } = await setup();
		const first = await alice.mutation(api.store.addresses.saveAddress, { ...home, label: 'First' });
		await alice.mutation(api.store.addresses.saveAddress, { ...home, label: 'Second' });
		await alice.mutation(api.store.addresses.deleteAddress, { id: first.addressId });
		const list = await alice.query(api.store.addresses.listAddresses, {});
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ label: 'Second', isDefault: true });
	});

	it('keeps the default when a different address is deleted', async () => {
		const { alice } = await setup();
		await alice.mutation(api.store.addresses.saveAddress, { ...home, label: 'First' });
		const second = await alice.mutation(api.store.addresses.saveAddress, { ...home, label: 'Second' });
		await alice.mutation(api.store.addresses.deleteAddress, { id: second.addressId });
		const list = await alice.query(api.store.addresses.listAddresses, {});
		expect(list).toEqual([expect.objectContaining({ label: 'First', isDefault: true })]);
	});
});

describe('setDeliveryAreas (internal)', () => {
	it('replaces the list, and saved addresses can then only use the new areas', async () => {
		const { t, alice } = await setup();
		await t.mutation(internal.store.seed.setDeliveryAreas, { areas: ['Govt College', ' Boys Hostel '] });
		await expect(alice.mutation(api.store.addresses.saveAddress, home)).rejects.toThrow(/OUT_OF_AREA/);
		await alice.mutation(api.store.addresses.saveAddress, { ...home, area: 'Boys Hostel' });
		const info = await t.query(api.store.catalog.getStoreInfo, {});
		expect(info!.deliveryAreas).toEqual(['Govt College', 'Boys Hostel']);
	});

	it('refuses an empty list', async () => {
		const { t } = await setup();
		await expect(t.mutation(internal.store.seed.setDeliveryAreas, { areas: [] })).rejects.toThrow(
			/INVALID_AREAS/
		);
	});
});
