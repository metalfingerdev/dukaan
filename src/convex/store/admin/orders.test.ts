import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../_generated/api';
import { failure, idOf, setupStore as setup, stockOf, type StoreTest } from '../harness.testutils';

const { listOrders, acceptOrder, packOrder, cancelOrder } = api.store.admin.orders;

// 12:00 IST on 3 Nov 2026: inside the placeholder opening hours
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.UTC(2026, 10, 3, 6, 30));
});
afterEach(() => vi.useRealTimers());

// 4 x 29.00 milk + 20.00 delivery (above the minimum order and the small-cart level)
const ORDER_TOTAL = 13_600;

const placeOrder = async (s: StoreTest) => {
	const productId = await idOf(s.t, 'toned-milk-500ml');
	await s.alice.mutation(api.store.cart.setQuantity, { productId, quantity: 4 });
	const { addressId } = await s.alice.mutation(api.store.addresses.saveAddress, {
		label: 'Home',
		kind: 'house',
		line1: '12, Test Street',
		area: 'Main Market (placeholder)',
		contactName: 'Test Customer',
		contactPhone: '9876543210'
	});
	return (
		await s.alice.mutation(api.store.orders.placeOrder, {
			addressId,
			paymentMethod: 'cod',
			idempotencyKey: 'board-test-key-abcdef',
			expectedTotalPaise: ORDER_TOTAL
		})
	).orderId;
};

describe('access', () => {
	it('refuses customers on the board and changes nothing', async () => {
		const s = await setup();
		const orderId = await placeOrder(s);
		for (const caller of [s.t, s.alice]) {
			const denied = /Not authenticated|Forbidden/;
			await expect(caller.query(listOrders, { status: 'placed' })).rejects.toThrow(denied);
			await expect(caller.mutation(acceptOrder, { orderId })).rejects.toThrow(denied);
			await expect(caller.mutation(cancelOrder, { orderId, reason: 'x' })).rejects.toThrow(denied);
		}
		const order = await s.alice.query(api.store.orders.getOrder, { orderId });
		expect(order!.status).toBe('placed');
	});
});

describe('the board', () => {
	it('moves an order along its columns, and the second of two racing taps is refused', async () => {
		const s = await setup();
		const orderId = await placeOrder(s);
		expect(await s.admin.query(listOrders, { status: 'placed' })).toHaveLength(1);

		await s.admin.mutation(acceptOrder, { orderId });
		expect(await s.admin.query(listOrders, { status: 'placed' })).toHaveLength(0);
		expect(await s.admin.query(listOrders, { status: 'accepted' })).toHaveLength(1);
		expect((await failure(s.admin.mutation(acceptOrder, { orderId }))).code).toBe('INVALID_TRANSITION');

		await s.admin.mutation(packOrder, { orderId });
		const [packed] = await s.admin.query(listOrders, { status: 'packed' });
		expect(packed).toMatchObject({ itemCount: 4, paymentMethod: 'cod' });
		expect(packed).not.toHaveProperty('deliveryCode');
	});

	it('cancels with a reason the customer sees, and puts the stock back', async () => {
		const s = await setup();
		const start = await stockOf(s.t, 'toned-milk-500ml');
		const orderId = await placeOrder(s);
		expect(await stockOf(s.t, 'toned-milk-500ml')).toBe(start - 4);

		expect((await failure(s.admin.mutation(cancelOrder, { orderId, reason: '   ' }))).code).toBe('INVALID_REASON');
		await s.admin.mutation(cancelOrder, { orderId, reason: 'Out of  fresh milk' });

		expect(await stockOf(s.t, 'toned-milk-500ml')).toBe(start);
		const order = await s.alice.query(api.store.orders.getOrder, { orderId });
		expect(order!.status).toBe('cancelled');
		expect(order!.events[order!.events.length - 1]).toMatchObject({ status: 'cancelled', note: 'Out of fresh milk' });
	});
});
