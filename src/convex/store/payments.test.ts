import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { transitionOrder } from '../model/store/orderStatus';
import { failure, idOf, setupStore as setup, stockOf, type Client, type StoreTest } from './harness.testutils';

// 12:00 IST on 3 Nov 2026: inside the placeholder opening hours
const NOON_IST = Date.UTC(2026, 10, 3, 6, 30);
const SECRET = 'test-webhook-secret';
beforeEach(() => {
	// Scheduled functions (calls to Razorpay, the payment expiry) run only when a test asks
	vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
	vi.setSystemTime(NOON_IST);
	vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', SECRET);
	// No keys: any gateway call a test triggers by accident fails closed, never reaching Razorpay
	vi.stubEnv('RAZORPAY_KEY_ID', '');
	vi.stubEnv('RAZORPAY_KEY_SECRET', '');
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

// 4 x 29.00 milk + 20.00 delivery
const ORDER_TOTAL = 13_600;
const MILK = 'toned-milk-500ml';
let keys = 0;

const placeOrder = async (s: StoreTest, paymentMethod: 'online' | 'cod' = 'online', client: Client = s.alice) => {
	await client.mutation(api.store.cart.setQuantity, { productId: await idOf(s.t, MILK), quantity: 4 });
	const { addressId } = await client.mutation(api.store.addresses.saveAddress, {
		label: 'Home',
		kind: 'house',
		line1: '12, Test Street',
		area: 'Main Market (placeholder)',
		contactName: 'Test Customer',
		contactPhone: '9876543210',
		lat: 23.2,
		lng: 77.4
	});
	const { orderId } = await client.mutation(api.store.orders.placeOrder, {
		addressId,
		paymentMethod,
		idempotencyKey: `payments-test-${++keys}-abcdef`,
		expectedTotalPaise: ORDER_TOTAL
	});
	return orderId;
};

/** As if `createOrderForPayment` had reached Razorpay: the order now has a Razorpay order id */
const withRazorpayOrder = async (s: StoreTest, orderId: Id<'orders'>, razorpayOrderId = 'order_test1') => {
	await s.t.run(async (ctx) => {
		const payment = await ctx.db
			.query('onlinePayments')
			.withIndex('by_orderId', (q) => q.eq('orderId', orderId))
			.unique();
		await ctx.db.patch(payment!._id, { status: 'created', razorpayOrderId });
	});
	return razorpayOrderId;
};

const sign = async (body: string) => {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
	return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const webhook = async (s: StoreTest, event: string, payload: object) => {
	const body = JSON.stringify({ entity: 'event', event, payload });
	return (await s.t.fetch('/razorpay-webhook', { method: 'POST', body, headers: { 'x-razorpay-signature': await sign(body) } })).status;
};
const captured = (razorpayOrderId: string, amount = ORDER_TOTAL, id = 'pay_test1') => ({
	payment: { entity: { id, amount, status: 'captured', order_id: razorpayOrderId, method: 'card' } }
});

const orderOf = (s: StoreTest, orderId: Id<'orders'>) => s.t.run((ctx) => ctx.db.get(orderId));
const board = (s: StoreTest) => s.admin.query(api.store.admin.orders.listOrders, { status: 'placed' });

describe('paying online at checkout', () => {
	it('holds the stock but keeps the order off the board until Razorpay confirms the payment', async () => {
		const s = await setup();
		const start = await stockOf(s.t, MILK);
		const orderId = await placeOrder(s);
		expect(await orderOf(s, orderId)).toMatchObject({ status: 'awaiting_payment', paymentStatus: 'pending' });
		expect(await stockOf(s.t, MILK)).toBe(start - 4);
		expect(await board(s)).toEqual([]);

		const razorpayOrderId = await withRazorpayOrder(s, orderId);
		expect(await webhook(s, 'payment.captured', captured(razorpayOrderId, ORDER_TOTAL - 1))).toBe(200);
		expect(await orderOf(s, orderId)).toMatchObject({ status: 'awaiting_payment', paymentStatus: 'pending' });

		expect(await webhook(s, 'payment.captured', captured(razorpayOrderId))).toBe(200);
		expect(await webhook(s, 'order.paid', captured(razorpayOrderId))).toBe(200); // both events arrive
		expect(await orderOf(s, orderId)).toMatchObject({ status: 'placed', paymentStatus: 'paid', paidWith: 'online' });
		expect(await board(s)).toHaveLength(1);
		const events = await s.t.run((ctx) => ctx.db.query('orderEvents').collect());
		expect(events.map((e) => e.status)).toEqual(['awaiting_payment', 'placed']);
	});

	it('cancels an order not paid in time and puts the stock back, but never a paid one', async () => {
		const s = await setup();
		const start = await stockOf(s.t, MILK);
		const unpaid = await placeOrder(s);
		await s.t.mutation(internal.store.payments.cancelIfUnpaid, { orderId: unpaid });
		expect(await orderOf(s, unpaid)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' });
		expect(await stockOf(s.t, MILK)).toBe(start);

		const paid = await placeOrder(s);
		await webhook(s, 'order.paid', captured(await withRazorpayOrder(s, paid, 'order_test2')));
		await s.t.mutation(internal.store.payments.cancelIfUnpaid, { orderId: paid });
		expect(await orderOf(s, paid)).toMatchObject({ status: 'placed', paymentStatus: 'paid' });
	});

	it('refunds money that arrives after the order was cancelled for not being paid', async () => {
		const s = await setup();
		const orderId = await placeOrder(s);
		const razorpayOrderId = await withRazorpayOrder(s, orderId);
		await s.t.mutation(internal.store.payments.cancelIfUnpaid, { orderId });
		await webhook(s, 'payment.captured', captured(razorpayOrderId));
		expect(await orderOf(s, orderId)).toMatchObject({
			status: 'cancelled',
			paymentStatus: 'paid',
			refund: { status: 'requesting' }
		});
	});

	it("is only the customer's own order to pay, and only while it waits for payment", async () => {
		const s = await setup();
		const orderId = await placeOrder(s);
		for (const call of [
			s.bob.mutation(api.store.payments.retryOnlinePayment, { orderId }),
			s.bob.mutation(api.store.payments.checkOnlinePayment, { orderId })
		]) {
			expect((await failure(call)).code).toBe('ORDER_NOT_FOUND');
		}
		await webhook(s, 'order.paid', captured(await withRazorpayOrder(s, orderId)));
		expect((await failure(s.alice.mutation(api.store.payments.retryOnlinePayment, { orderId }))).code).toBe('NOT_PAYABLE');
	});
});

describe('refunds', () => {
	it('start when a paid online order is cancelled, never for cash, and finish from the webhook', async () => {
		const s = await setup();
		const online = await placeOrder(s);
		await webhook(s, 'order.paid', captured(await withRazorpayOrder(s, online)));
		await s.admin.mutation(api.store.admin.orders.cancelOrder, { orderId: online, reason: 'Out of stock' });
		expect((await orderOf(s, online))!.refund).toEqual({ status: 'requesting' });

		const cash = await placeOrder(s, 'cod');
		await s.admin.mutation(api.store.admin.orders.cancelOrder, { orderId: cash, reason: 'Out of stock' });
		expect((await orderOf(s, cash))!.refund).toBeUndefined();

		// Razorpay can't be reached (no keys in tests): the refund is marked failed for the admin, not lost
		await s.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(60_000));
		expect(await orderOf(s, online)).toMatchObject({ paymentStatus: 'paid', refund: { status: 'failed' } });
		expect((await orderOf(s, online))!.refund!.error).toMatch(/keys/);

		// When Razorpay accepts a refund and later reports it done
		await s.t.run((ctx) => ctx.db.patch(online, { refund: { status: 'requesting' } }));
		await s.t.mutation(internal.store.payments.saveRefund, { orderId: online, status: 'pending', refundId: 'rfnd_test1' });
		expect(await orderOf(s, online)).toMatchObject({ paymentStatus: 'refunded', refund: { status: 'pending' } });
		expect(await webhook(s, 'refund.processed', { refund: { entity: { id: 'rfnd_test1', status: 'processed' } } })).toBe(200);
		// a late answer to the original request can't undo it
		await s.t.mutation(internal.store.payments.saveRefund, { orderId: online, status: 'failed', error: 'late' });
		expect((await orderOf(s, online))!.refund).toMatchObject({ status: 'processed', refundId: 'rfnd_test1' });
		expect((await s.alice.query(api.store.orders.getOrder, { orderId: online }))!.refundStatus).toBe('processed');
	});

	it('show on the admin payments list, which customers cannot read', async () => {
		const s = await setup();
		const orderId = await placeOrder(s);
		await webhook(s, 'order.paid', captured(await withRazorpayOrder(s, orderId)));
		const [row] = await s.admin.query(api.store.admin.payments.listGatewayPayments, {});
		expect(row).toMatchObject({ kind: 'online', amountPaise: ORDER_TOTAL, paymentId: 'pay_test1', orderStatus: 'placed' });
		await expect(s.alice.query(api.store.admin.payments.listGatewayPayments, {})).rejects.toThrow(/Forbidden/);
	});
});

describe('the order flow it joins', () => {
	it('lets a paid online order go all the way to delivery like any other', async () => {
		const s = await setup();
		const orderId = await placeOrder(s);
		await webhook(s, 'order.paid', captured(await withRazorpayOrder(s, orderId)));
		await s.t.run(async (ctx) => {
			for (const to of ['accepted', 'packed', 'out_for_delivery', 'delivered'] as const) {
				await transitionOrder(ctx, { orderId, to, actor: { kind: 'admin' } });
			}
		});
		const invoice = await s.alice.query(api.store.orders.getInvoice, { orderId });
		expect(invoice).toMatchObject({ paymentMethod: 'online', paidWith: 'online', totalPaise: ORDER_TOTAL });
	});
});
