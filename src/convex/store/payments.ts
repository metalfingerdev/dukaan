/**
 * Paying online at checkout, through Razorpay. An order paid this way starts as `awaiting_payment`
 * (not on the admin's board) with its stock held. The customer pays in Razorpay Checkout; the order
 * becomes `placed` and paid only when Razorpay says so: its signed webhook (http.ts) or a status
 * check against Razorpay's API. What the browser reports is never trusted, it only prompts a check.
 * An order not paid within the window is cancelled and its stock goes back; money that arrives for
 * a cancelled order is refunded. Refunds for any cancelled order paid through Razorpay start in
 * `transitionOrder` and are carried out here.
 */
import { ConvexError, v } from 'convex/values';
import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { env, internalAction, internalMutation, internalQuery, mutation } from '../_generated/server';
import { requireCustomer } from '../model/store/access';
import { startRefundIfPaid, transitionOrder } from '../model/store/orderStatus';
import {
	RazorpayError,
	createRazorpayOrder,
	listOrderPayments,
	razorpayKeys,
	refundPayment
} from '../model/store/razorpay';

/** How long a customer has to pay online before the order is cancelled and the stock released */
export const PAYMENT_WINDOW_MS = 15 * 60 * 1000;
/** Extra time before cancelling, so a payment made at the last second can still be confirmed */
const EXPIRY_GRACE_MS = 3 * 60 * 1000;
const CREATING_TIMEOUT_MS = 5 * 60 * 1000;

/** What the order page needs to open Razorpay Checkout. The key id is public by design. */
export const onlinePaymentView = v.object({
	status: v.union(v.literal('creating'), v.literal('created'), v.literal('paid'), v.literal('failed')),
	razorpayOrderId: v.optional(v.string()),
	keyId: v.optional(v.string()),
	amountPaise: v.number(),
	payBy: v.number()
});

const latestPayment = (ctx: Pick<QueryCtx, 'db'>, orderId: Id<'orders'>) =>
	ctx.db
		.query('onlinePayments')
		.withIndex('by_orderId', (q) => q.eq('orderId', orderId))
		.order('desc')
		.first();

/** The online payment as the customer's order page shows it, or `undefined` for other orders */
export const onlinePaymentFor = async (ctx: Pick<QueryCtx, 'db'>, order: Doc<'orders'>) => {
	if (order.paymentMethod !== 'online') return undefined;
	const payment = await latestPayment(ctx, order._id);
	return {
		status: payment?.status ?? ('failed' as const),
		razorpayOrderId: payment?.razorpayOrderId,
		keyId: payment?.status === 'created' ? env.RAZORPAY_KEY_ID : undefined,
		amountPaise: order.totalPaise,
		payBy: order._creationTime + PAYMENT_WINDOW_MS
	};
};

/** Called by `placeOrder` for an online order: start the Razorpay order and the expiry clock */
export async function beginOnlinePayment(ctx: MutationCtx, orderId: Id<'orders'>, amountPaise: number) {
	const paymentId = await ctx.db.insert('onlinePayments', { orderId, amountPaise, status: 'creating' });
	await ctx.scheduler.runAfter(0, internal.store.payments.createOrderForPayment, { paymentId });
	await ctx.scheduler.runAfter(PAYMENT_WINDOW_MS + EXPIRY_GRACE_MS, internal.store.payments.expireUnpaid, {
		orderId
	});
}

const customersUnpaidOrder = async (ctx: MutationCtx, orderId: string) => {
	const user = await requireCustomer(ctx);
	const id = ctx.db.normalizeId('orders', orderId);
	const order = id ? await ctx.db.get(id) : null;
	if (!order || order.userId !== user._id) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });
	return order;
};

/**
 * Makes sure the customer's unpaid online order has a Razorpay order to pay against, making a new
 * one only if the last attempt to create one failed. Throws `ORDER_NOT_FOUND` or `NOT_PAYABLE`.
 */
export const retryOnlinePayment = mutation({
	args: { orderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const order = await customersUnpaidOrder(ctx, args.orderId);
		if (order.status !== 'awaiting_payment' || order.paymentStatus !== 'pending') {
			throw new ConvexError({ code: 'NOT_PAYABLE' });
		}
		const payment = await latestPayment(ctx, order._id);
		if (payment?.status === 'created' || payment?.status === 'paid') return null;
		if (payment?.status === 'creating' && payment._creationTime > Date.now() - CREATING_TIMEOUT_MS) return null;
		const paymentId = await ctx.db.insert('onlinePayments', {
			orderId: order._id,
			amountPaise: order.totalPaise,
			status: 'creating'
		});
		await ctx.scheduler.runAfter(0, internal.store.payments.createOrderForPayment, { paymentId });
		return null;
	}
});

/**
 * After Razorpay Checkout says the payment went through, the page calls this; it only asks
 * Razorpay's API whether that is true. The page's own report is never used.
 */
export const checkOnlinePayment = mutation({
	args: { orderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const order = await customersUnpaidOrder(ctx, args.orderId);
		const payment = await latestPayment(ctx, order._id);
		if (payment?.status === 'created' && payment.razorpayOrderId) {
			await ctx.scheduler.runAfter(0, internal.store.payments.syncOnlinePayment, { orderId: order._id });
		}
		return null;
	}
});

// ---- gateway work (internal) ----

export const paymentForWork = internalQuery({
	args: { paymentId: v.id('onlinePayments') },
	returns: v.union(
		v.null(),
		v.object({ status: onlinePaymentView.fields.status, amountPaise: v.number(), orderId: v.id('orders'), orderNumber: v.number() })
	),
	handler: async (ctx, args) => {
		const payment = await ctx.db.get(args.paymentId);
		const order = payment ? await ctx.db.get(payment.orderId) : null;
		if (!payment || !order) return null;
		return { status: payment.status, amountPaise: payment.amountPaise, orderId: order._id, orderNumber: order.orderNumber };
	}
});

export const createOrderForPayment = internalAction({
	args: { paymentId: v.id('onlinePayments') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const payment = await ctx.runQuery(internal.store.payments.paymentForWork, args);
		if (!payment || payment.status !== 'creating') return null;
		try {
			const order = await createRazorpayOrder(razorpayKeys(), {
				amountPaise: payment.amountPaise,
				receipt: `order-${payment.orderNumber}-${args.paymentId.slice(-8)}`,
				notes: { orderId: payment.orderId, orderNumber: String(payment.orderNumber) }
			});
			await ctx.runMutation(internal.store.payments.savePaymentOrder, {
				paymentId: args.paymentId,
				razorpayOrderId: order.id
			});
		} catch (error) {
			const message = error instanceof RazorpayError ? error.description : 'could not reach Razorpay';
			await ctx.runMutation(internal.store.payments.failPaymentOrder, {
				paymentId: args.paymentId,
				error: message.slice(0, 300)
			});
		}
		return null;
	}
});

export const savePaymentOrder = internalMutation({
	args: { paymentId: v.id('onlinePayments'), razorpayOrderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const payment = await ctx.db.get(args.paymentId);
		if (payment?.status === 'creating') {
			await ctx.db.patch(payment._id, { status: 'created', razorpayOrderId: args.razorpayOrderId });
		}
		return null;
	}
});

export const failPaymentOrder = internalMutation({
	args: { paymentId: v.id('onlinePayments'), error: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const payment = await ctx.db.get(args.paymentId);
		if (payment?.status === 'creating') await ctx.db.patch(payment._id, { status: 'failed', error: args.error });
		return null;
	}
});

export const razorpayOrderIdsFor = internalQuery({
	args: { orderId: v.id('orders') },
	returns: v.array(v.string()),
	handler: async (ctx, args) => {
		const payments = await ctx.db
			.query('onlinePayments')
			.withIndex('by_orderId', (q) => q.eq('orderId', args.orderId))
			.take(20);
		return payments.flatMap((payment) => (payment.status === 'created' && payment.razorpayOrderId ? [payment.razorpayOrderId] : []));
	}
});

/** Asks Razorpay whether any of the order's Razorpay orders has a captured payment, and records it */
export const syncOnlinePayment = internalAction({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const ids = await ctx.runQuery(internal.store.payments.razorpayOrderIdsFor, args);
		for (const razorpayOrderId of ids) {
			const { items } = await listOrderPayments(razorpayKeys(), razorpayOrderId);
			const captured = items.find((payment) => payment.status === 'captured');
			if (captured) {
				await ctx.runMutation(internal.store.payments.recordOnlinePayment, {
					razorpayOrderId,
					paymentId: captured.id,
					amountPaise: captured.amount
				});
			}
		}
		return null;
	}
});

/**
 * Records a captured payment on one of our Razorpay orders. Called by the verified webhook and by
 * `syncOnlinePayment`; safe to call again for the same payment. The order moves to the board
 * (`placed`). If it had already been cancelled (the payment came too late), the money is refunded.
 */
export const recordOnlinePayment = internalMutation({
	args: { razorpayOrderId: v.string(), paymentId: v.string(), amountPaise: v.number() },
	returns: v.union(v.literal('recorded'), v.literal('duplicate'), v.literal('ignored')),
	handler: async (ctx, args) => {
		const payment = await ctx.db
			.query('onlinePayments')
			.withIndex('by_razorpayOrderId', (q) => q.eq('razorpayOrderId', args.razorpayOrderId))
			.unique();
		if (!payment) return 'ignored';
		if (payment.status === 'paid') return 'duplicate';
		if (args.amountPaise !== payment.amountPaise) {
			console.error(`Payment ${args.paymentId} on ${args.razorpayOrderId} is ${args.amountPaise}, expected ${payment.amountPaise}`);
			return 'ignored';
		}
		const order = await ctx.db.get(payment.orderId);
		if (!order) return 'ignored';
		if (order.paymentStatus !== 'pending') {
			// Paid twice through two Razorpay orders: shouldn't happen, as one is reused per order
			console.error(`Order ${order.orderNumber} already ${order.paymentStatus}; payment ${args.paymentId} needs a manual refund`);
			return 'ignored';
		}

		await ctx.db.patch(payment._id, { status: 'paid', paymentId: args.paymentId, paidAt: Date.now() });
		await ctx.db.patch(order._id, { paymentStatus: 'paid', paidWith: 'online' });
		if (order.status === 'awaiting_payment') {
			await transitionOrder(ctx, { orderId: order._id, to: 'placed', actor: { kind: 'system' } });
		} else if (order.status === 'cancelled') {
			await startRefundIfPaid(ctx, (await ctx.db.get(order._id))!);
		}
		return 'recorded';
	}
});

/** At the end of the payment window: one last check with Razorpay, then cancel if still unpaid */
export const expireUnpaid = internalAction({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		try {
			await ctx.runAction(internal.store.payments.syncOnlinePayment, args);
		} catch (error) {
			// Razorpay unreachable: cancel anyway; a payment that turns up later is refunded
			console.error('Last payment check failed', error);
		}
		await ctx.runMutation(internal.store.payments.cancelIfUnpaid, args);
		return null;
	}
});

export const cancelIfUnpaid = internalMutation({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (order?.status !== 'awaiting_payment') return null;
		await transitionOrder(ctx, {
			orderId: order._id,
			to: 'cancelled',
			actor: { kind: 'system' },
			note: 'Payment was not completed in time'
		});
		return null;
	}
});

// ---- refunds ----

export const refundForWork = internalQuery({
	args: { orderId: v.id('orders') },
	returns: v.union(v.null(), v.object({ paymentId: v.string(), orderNumber: v.number() })),
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (order?.refund?.status !== 'requesting') return null;
		const [online, qr] = await Promise.all([
			ctx.db
				.query('onlinePayments')
				.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
				.take(20),
			ctx.db
				.query('upiQrs')
				.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
				.take(20)
		]);
		const paymentId =
			online.find((payment) => payment.status === 'paid')?.paymentId ??
			qr.find((payment) => payment.status === 'paid')?.paymentId;
		return paymentId ? { paymentId, orderNumber: order.orderNumber } : null;
	}
});

export const refundOrder = internalAction({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const work = await ctx.runQuery(internal.store.payments.refundForWork, args);
		if (!work) {
			await ctx.runMutation(internal.store.payments.saveRefund, {
				orderId: args.orderId,
				status: 'failed',
				error: 'no captured Razorpay payment found for this order'
			});
			return null;
		}
		try {
			// One refund per order: the receipt makes a retried request a duplicate, not a second refund
			const refund = await refundPayment(razorpayKeys(), work.paymentId, `refund-order-${work.orderNumber}`);
			await ctx.runMutation(internal.store.payments.saveRefund, {
				orderId: args.orderId,
				status: refund.status === 'processed' ? 'processed' : refund.status === 'failed' ? 'failed' : 'pending',
				refundId: refund.id
			});
		} catch (error) {
			const message = error instanceof RazorpayError ? error.description : 'could not reach Razorpay';
			await ctx.runMutation(internal.store.payments.saveRefund, {
				orderId: args.orderId,
				status: 'failed',
				error: message.slice(0, 300)
			});
		}
		return null;
	}
});

export const saveRefund = internalMutation({
	args: {
		orderId: v.id('orders'),
		status: v.union(v.literal('pending'), v.literal('processed'), v.literal('failed')),
		refundId: v.optional(v.string()),
		error: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		// Only the answer to our own request; never overwrite what a webhook already settled
		if (order?.refund?.status !== 'requesting') return null;
		await ctx.db.patch(order._id, {
			refund: {
				status: args.status,
				...(args.refundId ? { refundId: args.refundId } : {}),
				...(args.error ? { error: args.error } : {})
			},
			...(args.status !== 'failed' ? { paymentStatus: 'refunded' as const } : {})
		});
		return null;
	}
});

/** From the webhook: a refund we asked for has finished, one way or the other */
export const recordRefundEvent = internalMutation({
	args: { refundId: v.string(), status: v.union(v.literal('processed'), v.literal('failed')) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const order = await ctx.db
			.query('orders')
			.withIndex('by_refundId', (q) => q.eq('refund.refundId', args.refundId))
			.unique();
		if (!order?.refund) return null;
		await ctx.db.patch(order._id, { refund: { ...order.refund, status: args.status } });
		return null;
	}
});
