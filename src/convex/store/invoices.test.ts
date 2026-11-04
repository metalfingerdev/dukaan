import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { transitionOrder } from '../model/store/orderStatus';
import { failure, idOf, patchProduct, setupStore as setup, type Client, type StoreTest } from './harness.testutils';

// 12:00 IST on 3 Nov 2026, in financial year 26-27
const NOON_IST = Date.UTC(2026, 10, 3, 6, 30);
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOON_IST);
});
afterEach(() => vi.useRealTimers());

// 4 x 29.00 milk + 20.00 delivery
const ORDER_TOTAL = 13_600;
let keys = 0;

const placeOrder = async (s: StoreTest, client: Client = s.alice) => {
	await client.mutation(api.store.cart.setQuantity, { productId: await idOf(s.t, 'toned-milk-500ml'), quantity: 4 });
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
		paymentMethod: 'cod',
		idempotencyKey: `invoice-test-${++keys}-abcdef`,
		expectedTotalPaise: ORDER_TOTAL
	});
	return orderId;
};

const moveTo = (s: StoreTest, orderId: Id<'orders'>, ...steps: Parameters<typeof transitionOrder>[1]['to'][]) =>
	s.t.run(async (ctx) => {
		for (const to of steps) await transitionOrder(ctx, { orderId, to, actor: { kind: 'admin' } });
	});
const deliver = (s: StoreTest, orderId: Id<'orders'>) =>
	moveTo(s, orderId, 'accepted', 'packed', 'out_for_delivery', 'delivered');

const numberOf = async (s: StoreTest, orderId: Id<'orders'>) =>
	(await s.t.run((ctx) => ctx.db.get(orderId)))!.invoiceNumber;

describe('invoice numbers', () => {
	it('are given only on delivery, in order, with no gap for a cancelled order', async () => {
		const s = await setup();
		const first = await placeOrder(s);
		await moveTo(s, first, 'accepted', 'packed', 'out_for_delivery');
		expect(await numberOf(s, first)).toBeUndefined();
		await moveTo(s, first, 'delivered');

		const cancelled = await placeOrder(s);
		await moveTo(s, cancelled, 'accepted', 'cancelled');
		const third = await placeOrder(s);
		await deliver(s, third);

		expect(await numberOf(s, first)).toBe('DK/26-27/000001');
		expect(await numberOf(s, cancelled)).toBeUndefined();
		expect(await numberOf(s, third)).toBe('DK/26-27/000002');
	});

	it('start again at 000001 in a new financial year', async () => {
		const s = await setup();
		await deliver(s, await placeOrder(s));
		vi.setSystemTime(Date.UTC(2027, 3, 1, 6, 30)); // 1 April 2027, noon IST
		const next = await placeOrder(s);
		await deliver(s, next);
		expect(await numberOf(s, next)).toBe('DK/27-28/000001');
	});
});

describe('the invoice', () => {
	it('keeps the details it was issued with when the store changes them later', async () => {
		const s = await setup();
		const before = await placeOrder(s);
		await deliver(s, before);
		const details = { legalName: 'New Legal Name', addressLine: 'New address', invoicePrefix: 'NEW' };
		await s.admin.mutation(api.store.admin.settings.updateInvoiceDetails, details);
		const after = await placeOrder(s);
		await deliver(s, after);

		const old = (await s.alice.query(api.store.orders.getInvoice, { orderId: before }))!;
		expect(old.invoiceNumber).toBe('DK/26-27/000001');
		expect(old.seller.legalName).not.toBe('New Legal Name');
		const fresh = (await s.alice.query(api.store.orders.getInvoice, { orderId: after }))!;
		expect(fresh).toMatchObject({ invoiceNumber: 'NEW/26-27/000002', seller: { legalName: 'New Legal Name' } });
	});

	it('shows the tax inside the price only with a GSTIN, and still adds up to what the customer paid', async () => {
		const s = await setup();
		await patchProduct(s.t, 'toned-milk-500ml', { gstRatePercent: 5, hsn: '0401' });
		const plain = await placeOrder(s);
		await deliver(s, plain);
		expect(await s.alice.query(api.store.orders.getInvoice, { orderId: plain })).not.toHaveProperty('taxTotals');

		await s.admin.mutation(api.store.admin.settings.updateInvoiceDetails, {
			legalName: 'Shop',
			addressLine: 'Main road',
			invoicePrefix: 'DK',
			gstin: '23AAAAA0000A1Z5'
		});
		const taxed = await placeOrder(s);
		await deliver(s, taxed);
		const invoice = (await s.alice.query(api.store.orders.getInvoice, { orderId: taxed }))!;
		const { taxablePaise, cgstPaise, sgstPaise } = invoice.taxTotals!;
		expect(taxablePaise + cgstPaise + sgstPaise).toBe(invoice.subtotalPaise);
		expect(invoice.subtotalPaise + invoice.deliveryFeePaise + invoice.smallCartFeePaise).toBe(invoice.totalPaise);
		expect(invoice.totalPaise).toBe(ORDER_TOTAL);
		expect(invoice.lines[0]).toMatchObject({ hsn: '0401', gstRatePercent: 5 });
	});

	it("is only for the order's owner and the admin, and only once delivered", async () => {
		const s = await setup();
		const orderId = await placeOrder(s);
		expect(await s.alice.query(api.store.orders.getInvoice, { orderId })).toBeNull();
		await deliver(s, orderId);
		expect(await s.bob.query(api.store.orders.getInvoice, { orderId })).toBeNull();
		expect(await s.admin.query(api.store.admin.orders.getInvoice, { orderId })).toMatchObject({ orderNumber: 1 });
		await expect(s.alice.query(api.store.admin.orders.getInvoice, { orderId })).rejects.toThrow(/Forbidden/);
		await expect(s.alice.mutation(api.store.admin.settings.updateInvoiceDetails, {
			legalName: 'x', addressLine: 'x', invoicePrefix: 'X'
		})).rejects.toThrow(/Forbidden/);
		expect((await failure(s.admin.mutation(api.store.admin.settings.updateInvoiceDetails, {
			legalName: 'x', addressLine: 'x', invoicePrefix: 'TOOLONG'
		}))).code).toBe('INVALID_INVOICE_DETAILS');
	});
});
