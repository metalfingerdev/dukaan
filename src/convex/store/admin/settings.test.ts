import { describe, expect, it } from 'vitest';
import { api } from '../../_generated/api';
import { STORE_SETTINGS_DEFAULTS } from '../../model/store/storeProfile';
import { setupStore as setup } from '../harness.testutils';

const { getSettings, updateSettings, setStoreOpen } = api.store.admin.settings;

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
