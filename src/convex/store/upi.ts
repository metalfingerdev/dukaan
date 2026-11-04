/**
 * UPI at the door, confirmed by Razorpay. When an unpaid order is out for delivery, the rider (or
 * the customer, on their order page) asks for a QR. The server creates a single-use Razorpay UPI QR
 * fixed to the order total; the customer scans it; Razorpay's signed webhook (http.ts) calls
 * `recordPayment`, the order becomes paid and both screens show it live. If the webhook is late,
 * "Check payment" asks Razorpay directly. Nobody can mark a UPI payment by hand.
 *
 * The public functions each call one access guard; the internal ones do the gateway work.
 */
import { ConvexError, v } from 'convex/values';
import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { env, internalAction, internalMutation, internalQuery, mutation } from '../_generated/server';
import { requireCustomer, requireDeliveryPartner } from '../model/store/access';
import {
	QR_LIFETIME_MS,
	RazorpayError,
	checkKeys,
	createUpiQr,
	listQrPayments,
	type RazorpayKeys
} from '../model/store/razorpay';

/** A QR still being made after this long is treated as lost, so a new one can be asked for */
const CREATING_TIMEOUT_MS = 10 * 60 * 1000;
/** Don't hand out a QR that closes within this long; make a fresh one instead */
const MIN_REMAINING_MS = 2 * 60 * 1000;

/** What the order pages show about the UPI QR */
export const upiQrView = v.object({
	status: v.union(v.literal('creating'), v.literal('active'), v.literal('paid'), v.literal('failed')),
	imageUrl: v.optional(v.string()),
	closeBy: v.optional(v.number()),
	amountPaise: v.number()
});

const latestQr = (ctx: Pick<QueryCtx, 'db'>, orderId: Id<'orders'>) =>
	ctx.db
		.query('upiQrs')
		.withIndex('by_orderId', (q) => q.eq('orderId', orderId))
		.order('desc')
		.first();

/** The newest QR for an order, as the order pages show it, or `undefined` when there is none */
export const upiQrFor = async (ctx: Pick<QueryCtx, 'db'>, orderId: Id<'orders'>) => {
	const qr = await latestQr(ctx, orderId);
	if (!qr) return undefined;
	return { status: qr.status, imageUrl: qr.imageUrl, closeBy: qr.closeBy, amountPaise: qr.amountPaise };
};

const canPayByQr = (order: Doc<'orders'>) =>
	order.status === 'out_for_delivery' && order.paymentStatus === 'pending';

/**
 * Makes sure the order has a payable QR: reuses one that is still open, otherwise starts a new one.
 * Never two open QRs for one order, so a customer can't pay twice.
 */
const ensureQr = async (ctx: MutationCtx, order: Doc<'orders'>) => {
	if (!canPayByQr(order)) throw new ConvexError({ code: 'NOT_PAYABLE' });
	const now = Date.now();
	const current = await latestQr(ctx, order._id);
	if (current?.status === 'paid') throw new ConvexError({ code: 'NOT_PAYABLE' });
	if (current?.status === 'active' && (current.closeBy ?? 0) > now + MIN_REMAINING_MS) return null;
	if (current?.status === 'creating' && current._creationTime > now - CREATING_TIMEOUT_MS) return null;
	if (current?.status === 'creating') await ctx.db.patch(current._id, { status: 'failed', error: 'timed out' });

	const qrRowId = await ctx.db.insert('upiQrs', {
		orderId: order._id,
		amountPaise: order.totalPaise,
		status: 'creating'
	});
	await ctx.scheduler.runAfter(0, internal.store.upi.createQr, { qrRowId });
	return null;
};

/** Asks Razorpay to check for a payment the webhook hasn't told us about yet */
const scheduleCheck = async (ctx: MutationCtx, order: Doc<'orders'>) => {
	const qr = await latestQr(ctx, order._id);
	if (qr?.status === 'active' && qr.qrId) {
		await ctx.scheduler.runAfter(0, internal.store.upi.syncQr, { qrRowId: qr._id });
	}
	return null;
};

const partnersOrder = async (ctx: MutationCtx, orderId: string) => {
	const { partner } = await requireDeliveryPartner(ctx);
	const id = ctx.db.normalizeId('orders', orderId);
	const order = id ? await ctx.db.get(id) : null;
	if (!order || order.assignedPartnerId !== partner._id) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });
	return order;
};

const customersOrder = async (ctx: MutationCtx, orderId: string) => {
	const user = await requireCustomer(ctx);
	const id = ctx.db.normalizeId('orders', orderId);
	const order = id ? await ctx.db.get(id) : null;
	if (!order || order.userId !== user._id) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });
	return order;
};

/** The rider asks for the QR of one of their orders. Throws `ORDER_NOT_FOUND` or `NOT_PAYABLE`. */
export const requestQrAsPartner = mutation({
	args: { orderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => ensureQr(ctx, await partnersOrder(ctx, args.orderId))
});

/** The customer asks for the QR of their own order, to pay from their phone */
export const requestQrAsCustomer = mutation({
	args: { orderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => ensureQr(ctx, await customersOrder(ctx, args.orderId))
});

export const checkPaymentAsPartner = mutation({
	args: { orderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => scheduleCheck(ctx, await partnersOrder(ctx, args.orderId))
});

export const checkPaymentAsCustomer = mutation({
	args: { orderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => scheduleCheck(ctx, await customersOrder(ctx, args.orderId))
});

// ---- gateway work (internal) ----

const keysOrThrow = (): RazorpayKeys => {
	if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new RazorpayError(0, 'Razorpay keys are not set');
	return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
};

export const qrForWork = internalQuery({
	args: { qrRowId: v.id('upiQrs') },
	returns: v.union(
		v.null(),
		v.object({
			status: upiQrView.fields.status,
			qrId: v.optional(v.string()),
			amountPaise: v.number(),
			orderNumber: v.number(),
			orderId: v.id('orders'),
			storeName: v.string()
		})
	),
	handler: async (ctx, args) => {
		const qr = await ctx.db.get(args.qrRowId);
		const order = qr ? await ctx.db.get(qr.orderId) : null;
		if (!qr || !order) return null;
		const settings = await ctx.db.query('storeSettings').first();
		return {
			status: qr.status,
			qrId: qr.qrId,
			amountPaise: qr.amountPaise,
			orderNumber: order.orderNumber,
			orderId: order._id,
			storeName: settings?.storeName ?? 'Store'
		};
	}
});

export const createQr = internalAction({
	args: { qrRowId: v.id('upiQrs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.runQuery(internal.store.upi.qrForWork, args);
		if (!row || row.status !== 'creating') return null;
		try {
			const qr = await createUpiQr(keysOrThrow(), {
				amountPaise: row.amountPaise,
				closeByMs: Date.now() + QR_LIFETIME_MS,
				name: row.storeName,
				description: `Order ${row.orderNumber}`,
				notes: { orderId: row.orderId, orderNumber: String(row.orderNumber) }
			});
			await ctx.runMutation(internal.store.upi.saveQr, {
				qrRowId: args.qrRowId,
				qrId: qr.id,
				imageUrl: qr.image_url,
				closeBy: qr.close_by * 1000
			});
		} catch (error) {
			const message = error instanceof RazorpayError ? error.description : 'could not reach Razorpay';
			await ctx.runMutation(internal.store.upi.failQr, { qrRowId: args.qrRowId, error: message.slice(0, 300) });
		}
		return null;
	}
});

export const saveQr = internalMutation({
	args: { qrRowId: v.id('upiQrs'), qrId: v.string(), imageUrl: v.string(), closeBy: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.db.get(args.qrRowId);
		if (!row || row.status !== 'creating') return null;
		// Only an https image from Razorpay is shown on the order pages
		const imageUrl = args.imageUrl.startsWith('https://') ? args.imageUrl : undefined;
		await ctx.db.patch(row._id, { status: 'active', qrId: args.qrId, imageUrl, closeBy: args.closeBy });
		return null;
	}
});

export const failQr = internalMutation({
	args: { qrRowId: v.id('upiQrs'), error: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.db.get(args.qrRowId);
		if (row?.status === 'creating') await ctx.db.patch(row._id, { status: 'failed', error: args.error });
		return null;
	}
});

export const syncQr = internalAction({
	args: { qrRowId: v.id('upiQrs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.runQuery(internal.store.upi.qrForWork, args);
		if (!row || row.status !== 'active' || !row.qrId) return null;
		const { items } = await listQrPayments(keysOrThrow(), row.qrId);
		const captured = items.find((payment) => payment.status === 'captured');
		if (captured) {
			await ctx.runMutation(internal.store.upi.recordPayment, {
				qrId: row.qrId,
				paymentId: captured.id,
				amountPaise: captured.amount
			});
		}
		return null;
	}
});

/**
 * Records a captured payment to one of our QRs. Called by the verified webhook and by `syncQr`.
 * Safe to call twice for the same payment (Razorpay resends webhooks). A payment for another
 * amount, or to a QR we don't know, changes nothing.
 */
export const recordPayment = internalMutation({
	args: { qrId: v.string(), paymentId: v.string(), amountPaise: v.number() },
	returns: v.union(v.literal('recorded'), v.literal('duplicate'), v.literal('ignored')),
	handler: async (ctx, args) => {
		const qr = await ctx.db
			.query('upiQrs')
			.withIndex('by_qrId', (q) => q.eq('qrId', args.qrId))
			.unique();
		if (!qr) return 'ignored';
		if (qr.status === 'paid') return 'duplicate';
		if (args.amountPaise !== qr.amountPaise) {
			console.error(`UPI payment ${args.paymentId} on ${args.qrId} is ${args.amountPaise}, expected ${qr.amountPaise}`);
			return 'ignored';
		}
		const now = Date.now();
		await ctx.db.patch(qr._id, { status: 'paid', paymentId: args.paymentId, paidAt: now });
		const order = await ctx.db.get(qr.orderId);
		if (order && order.paymentStatus === 'pending') {
			await ctx.db.patch(order._id, { paymentStatus: 'paid', paidWith: 'upi' });
		}
		return 'recorded';
	}
});

/**
 * Checks that the Razorpay account can make UPI QRs (Razorpay's support switches this on), by
 * creating a ₹1 test QR that closes in 5 minutes. Test keys only.
 * Run: `npx convex run store/upi:checkRazorpaySetup`
 */
export const checkRazorpaySetup = internalAction({
	args: {},
	returns: v.object({ ok: v.boolean(), detail: v.string() }),
	handler: async () => {
		try {
			const keys = keysOrThrow();
			if (!keys.keyId.startsWith('rzp_test_')) return { ok: false, detail: 'only runs with test keys' };
			try {
				await checkKeys(keys);
			} catch (error) {
				return { ok: false, detail: `the keys don't work: ${error instanceof Error ? error.message : error}` };
			}
			const qr = await createUpiQr(keys, {
				amountPaise: 100,
				closeByMs: Date.now() + 5 * 60 * 1000,
				name: 'Setup check',
				description: 'Setup check, not an order',
				notes: { purpose: 'setup check' }
			});
			return { ok: true, detail: `created ${qr.id}: ${qr.image_url}` };
		} catch (error) {
			const detail = error instanceof RazorpayError ? error.message : String(error);
			return { ok: false, detail: `keys work, but making a UPI QR failed (ask Razorpay to enable QR Codes): ${detail}` };
		}
	}
});
