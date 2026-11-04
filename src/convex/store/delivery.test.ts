import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../_generated/api';
import { MAX_CODE_ATTEMPTS } from './rateLimits';
import { failure, idOf, setupStore as setup, type StoreTest } from './harness.testutils';

const { myRuns, getRun, pickUp, markDelivered, markFailed } = api.store.delivery;

// 12:00 IST on 3 Nov 2026: inside the placeholder opening hours
const NOON_IST = Date.UTC(2026, 10, 3, 6, 30);
const DAY_START = Date.UTC(2026, 10, 2, 18, 30); // 00:00 IST on 3 Nov
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOON_IST);
});
afterEach(() => vi.useRealTimers());

// 4 x 29.00 milk + 20.00 delivery
const ORDER_TOTAL = 13_600;

const asPartner = (s: StoreTest, phoneNumber: string, verified = true) =>
	s.t.withIdentity({ subject: `user-${phoneNumber}`, phoneNumber, phoneNumberVerified: verified });

/** A packed order assigned to partner Ravi (+919876543210), and a second partner Sunil */
const setupRun = async () => {
	const s = await setup();
	const ravi = await s.admin.mutation(api.store.admin.delivery.addPartner, { name: 'Ravi', phoneNumber: '9876543210' });
	await s.admin.mutation(api.store.admin.delivery.addPartner, { name: 'Sunil', phoneNumber: '9123456780' });
	const productId = await idOf(s.t, 'toned-milk-500ml');
	await s.alice.mutation(api.store.cart.setQuantity, { productId, quantity: 4 });
	const { addressId } = await s.alice.mutation(api.store.addresses.saveAddress, {
		label: 'Home',
		kind: 'house',
		line1: '12, Test Street',
		area: 'Main Market (placeholder)',
		contactName: 'Test Customer',
		contactPhone: '9876501234'
	});
	const { orderId } = await s.alice.mutation(api.store.orders.placeOrder, {
		addressId,
		paymentMethod: 'cod',
		idempotencyKey: 'delivery-test-key-abcdef',
		expectedTotalPaise: ORDER_TOTAL
	});
	await s.admin.mutation(api.store.admin.orders.acceptOrder, { orderId });
	await s.admin.mutation(api.store.admin.orders.packOrder, { orderId });
	await s.admin.mutation(api.store.admin.orders.assignPartner, { orderId, partnerId: ravi });
	const code = await s.t.run(async (ctx) => (await ctx.db.get(orderId))!.deliveryCode);
	return {
		...s,
		orderId,
		code,
		ravi: asPartner(s, '+919876543210'),
		sunil: asPartner(s, '+919123456780')
	};
};

describe('who is a partner', () => {
	it('refuses signed-out visitors, customers, unverified numbers and switched-off partners', async () => {
		const s = await setupRun();
		const orderId = s.orderId;
		const unverified = asPartner(s, '+919876543210', false);
		const stranger = asPartner(s, '+919000000000');
		for (const caller of [s.t, s.alice, s.admin, unverified, stranger]) {
			await expect(caller.query(myRuns, { dayStartMs: DAY_START })).rejects.toThrow(/Not authenticated|Not a delivery partner/);
			await expect(caller.mutation(pickUp, { orderId })).rejects.toThrow(/Not authenticated|Not a delivery partner/);
		}
		const ravi = (await s.admin.query(api.store.admin.delivery.listPartners, {})).find((p) => p.name === 'Ravi')!;
		await s.admin.mutation(api.store.admin.delivery.setPartnerActive, { partnerId: ravi._id, isActive: false });
		await expect(s.ravi.query(myRuns, { dayStartMs: DAY_START })).rejects.toThrow(/Not a delivery partner/);
		const order = await s.alice.query(api.store.orders.getOrder, { orderId });
		expect(order!.status).toBe('packed');
	});

	it("keeps a partner out of another partner's order, and a missing id looks the same", async () => {
		const s = await setupRun();
		expect(await s.sunil.query(getRun, { orderId: s.orderId })).toBeNull();
		expect(await s.sunil.query(getRun, { orderId: 'not-an-id' })).toBeNull();
		expect((await s.sunil.query(myRuns, { dayStartMs: DAY_START })).toPickUp).toEqual([]);
		for (const call of [
			s.sunil.mutation(pickUp, { orderId: s.orderId }),
			s.sunil.mutation(markFailed, { orderId: s.orderId, reason: 'other' }),
			s.sunil.mutation(markDelivered, { orderId: s.orderId, code: s.code, paidWith: 'cash' })
		]) {
			expect((await failure(call)).code).toBe('ORDER_NOT_FOUND');
		}
		expect((await s.admin.query(api.store.admin.orders.listOrders, { status: 'packed' }))).toHaveLength(1);
	});
});

describe('the run', () => {
	it("shows the partner what they need and never the delivery code or the customer's account", async () => {
		const s = await setupRun();
		const runs = await s.ravi.query(myRuns, { dayStartMs: DAY_START });
		expect(runs.toPickUp).toMatchObject([{ orderNumber: 1, itemCount: 4, collectPaise: ORDER_TOTAL }]);

		const run = (await s.ravi.query(getRun, { orderId: s.orderId }))!;
		expect(run.customer).toMatchObject({ firstName: 'Test', phone: '+919876501234', line1: '12, Test Street' });
		expect(run.collectPaise).toBe(ORDER_TOTAL);
		expect(JSON.stringify(run)).not.toContain(s.code);
		for (const field of ['deliveryCode', 'userId', 'idempotencyKey']) expect(run).not.toHaveProperty(field);
	});

	it('goes pick up, deliver with the right code, and the cash is what the admin settles', async () => {
		const s = await setupRun();
		await s.ravi.mutation(pickUp, { orderId: s.orderId });
		expect((await s.ravi.query(myRuns, { dayStartMs: DAY_START })).onTheWay).toHaveLength(1);

		expect(await s.ravi.mutation(markDelivered, { orderId: s.orderId, code: s.code, paidWith: 'cash' })).toEqual({ ok: true });

		const order = await s.t.run((ctx) => ctx.db.get(s.orderId));
		expect(order).toMatchObject({ status: 'delivered', paymentStatus: 'paid', paidWith: 'cash', cashCollectedPaise: ORDER_TOTAL });
		const runs = await s.ravi.query(myRuns, { dayStartMs: DAY_START });
		expect(runs).toMatchObject({ deliveredToday: 1, cashToHandOverPaise: ORDER_TOTAL });
		const [row] = await s.admin.query(api.store.admin.delivery.cashToSettle, {});
		expect(row.days.map((d) => d.totalPaise)).toEqual([ORDER_TOTAL]);

		// finished: the phone is masked and the address is gone
		const done = (await s.ravi.query(getRun, { orderId: s.orderId }))!;
		expect(done).toMatchObject({ phoneLast4: '1234', area: 'Main Market (placeholder)' });
		expect(done).not.toHaveProperty('customer');
	});

	it('records a UPI payment without adding to the cash the partner owes', async () => {
		const s = await setupRun();
		await s.ravi.mutation(pickUp, { orderId: s.orderId });
		await s.ravi.mutation(markDelivered, { orderId: s.orderId, code: s.code, paidWith: 'upi' });
		const order = await s.t.run((ctx) => ctx.db.get(s.orderId));
		expect(order).toMatchObject({ paymentStatus: 'paid', paidWith: 'upi' });
		expect(order!.cashCollectedPaise).toBeUndefined();
		expect(await s.admin.query(api.store.admin.delivery.cashToSettle, {})).toEqual([]);
	});

	it('asks how the unpaid order was paid before it will deliver', async () => {
		const s = await setupRun();
		await s.ravi.mutation(pickUp, { orderId: s.orderId });
		expect((await failure(s.ravi.mutation(markDelivered, { orderId: s.orderId, code: s.code }))).code).toBe('PAYMENT_REQUIRED');
		expect((await s.t.run((ctx) => ctx.db.get(s.orderId)))!.status).toBe('out_for_delivery');
	});
});

describe('the delivery code', () => {
	it('refuses a wrong code, and stops guessing after five tries even if the next one is right', async () => {
		const s = await setupRun();
		await s.ravi.mutation(pickUp, { orderId: s.orderId });
		const wrong = s.code === '0000' ? '1111' : '0000';
		for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
			expect(await s.ravi.mutation(markDelivered, { orderId: s.orderId, code: wrong, paidWith: 'cash' })).toEqual({
				ok: false,
				reason: 'WRONG_CODE'
			});
		}
		const locked = await s.ravi.mutation(markDelivered, { orderId: s.orderId, code: s.code, paidWith: 'cash' });
		expect(locked).toMatchObject({ ok: false, reason: 'TOO_MANY_ATTEMPTS' });
		expect((await s.t.run((ctx) => ctx.db.get(s.orderId)))!.status).toBe('out_for_delivery');

		// ten minutes later the right code works
		vi.setSystemTime(NOON_IST + 11 * 60 * 1000);
		expect(await s.ravi.mutation(markDelivered, { orderId: s.orderId, code: s.code, paidWith: 'cash' })).toEqual({ ok: true });
	});

	it('cannot deliver an order that was never picked up', async () => {
		const s = await setupRun();
		expect((await failure(s.ravi.mutation(markDelivered, { orderId: s.orderId, code: s.code, paidWith: 'cash' }))).code).toBe(
			'INVALID_TRANSITION'
		);
	});
});

describe('a failed delivery', () => {
	it('shows the customer why, takes the order to the admin, and can go out again', async () => {
		const s = await setupRun();
		await s.ravi.mutation(pickUp, { orderId: s.orderId });
		await s.ravi.mutation(markFailed, { orderId: s.orderId, reason: 'not_reachable' });

		const order = await s.alice.query(api.store.orders.getOrder, { orderId: s.orderId });
		expect(order!.status).toBe('delivery_failed');
		expect(order!.events[order!.events.length - 1].note).toBe("We couldn't reach you by phone");

		const [failed] = await s.admin.query(api.store.admin.orders.listOrders, { status: 'delivery_failed' });
		expect(failed).toMatchObject({ failureNote: "We couldn't reach you by phone", assignedPartnerName: 'Ravi' });

		await s.admin.mutation(api.store.admin.orders.repackOrder, { orderId: s.orderId });
		expect(await s.admin.query(api.store.admin.orders.listOrders, { status: 'packed' })).toHaveLength(1);
	});

	it('is put back on the shelf when the admin cancels it', async () => {
		const s = await setupRun();
		await s.ravi.mutation(pickUp, { orderId: s.orderId });
		await s.ravi.mutation(markFailed, { orderId: s.orderId, reason: 'refused' });
		await s.admin.mutation(api.store.admin.orders.cancelOrder, { orderId: s.orderId, reason: 'Customer refused' });
		const gone = (await s.ravi.query(getRun, { orderId: s.orderId }))!;
		expect(gone.status).toBe('cancelled');
		expect(gone).not.toHaveProperty('customer');
		expect(gone).not.toHaveProperty('area');
	});
});
