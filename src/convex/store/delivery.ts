/**
 * The delivery partner's own orders: what to pick up, what is on the way, today's cash, and the
 * three moves a partner makes (picked up, delivered with the customer's code, couldn't deliver).
 * Every function calls `requireDeliveryPartner` and returns a purpose-built projection, never the
 * order document: no user id, no delivery code, and the customer's phone and address only while
 * the order is still open. Status changes go through `transitionOrder`.
 * See .agents/skills/store-app/references/delivery.md.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { mutation, query } from '../_generated/server';
import { DELIVERY_FAILURE_NOTES } from '../model/store/deliveryFailure';
import { requireDeliveryPartner } from '../model/store/access';
import { transitionOrder } from '../model/store/orderStatus';
import { istDayStartMs } from '../model/store/time';
import { deliveryRateLimiter } from './rateLimits';
import { orderStatus, paymentMethod, paymentStatus } from './validators';

const RUN_LIST_SIZE = 50;
const MAX_ITEMS_PER_ORDER = 50;
/** Newest delivered orders looked at for today's totals; matches the admin's cash view */
const DELIVERED_WINDOW = 200;
/** Statuses in which the partner still needs the customer's phone and address */
const OPEN_FOR_PARTNER: readonly Doc<'orders'>['status'][] = ['packed', 'out_for_delivery', 'delivery_failed'];

const notFound = () => new ConvexError({ code: 'ORDER_NOT_FOUND' });

/** What the partner still has to collect at the door, in paise */
const amountToCollect = (order: Doc<'orders'>) =>
	order.paymentStatus === 'pending' ? order.totalPaise : 0;

/** The order if it is assigned to this partner; a missing, malformed or someone else's id looks the same */
const myOrder = async (ctx: Pick<QueryCtx, 'db'>, partnerId: Id<'deliveryPartners'>, orderId: string) => {
	const id = ctx.db.normalizeId('orders', orderId);
	const order = id ? await ctx.db.get(id) : null;
	return order && order.assignedPartnerId === partnerId ? order : null;
};

const runSummary = v.object({
	_id: v.id('orders'),
	orderNumber: v.number(),
	status: orderStatus,
	area: v.string(),
	itemCount: v.number(),
	paymentMethod,
	collectPaise: v.number()
});

const toRunSummary = async (ctx: Pick<QueryCtx, 'db'>, order: Doc<'orders'>) => {
	const items = await ctx.db
		.query('orderItems')
		.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
		.take(MAX_ITEMS_PER_ORDER);
	return {
		_id: order._id,
		orderNumber: order.orderNumber,
		status: order.status,
		area: order.address.area,
		itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
		paymentMethod: order.paymentMethod,
		collectPaise: amountToCollect(order)
	};
};

/**
 * My runs: orders to pick up (packed), orders on the way, and today's tally. `dayStartMs` is the
 * start of today in India time (a query can't read the clock). `cashToHandOverPaise` is the same
 * figure the admin sees for this partner and day in /admin/delivery.
 */
export const myRuns = query({
	args: { dayStartMs: v.number() },
	returns: v.object({
		toPickUp: v.array(runSummary),
		onTheWay: v.array(runSummary),
		deliveredToday: v.number(),
		cashToHandOverPaise: v.number()
	}),
	handler: async (ctx, args) => {
		const { partner } = await requireDeliveryPartner(ctx);
		const withStatus = (status: 'packed' | 'out_for_delivery') =>
			ctx.db
				.query('orders')
				.withIndex('by_assignedPartnerId_and_status', (q) =>
					q.eq('assignedPartnerId', partner._id).eq('status', status)
				)
				.order('desc')
				.take(RUN_LIST_SIZE);
		const [packed, onTheWay, delivered] = await Promise.all([
			withStatus('packed'),
			withStatus('out_for_delivery'),
			ctx.db
				.query('orders')
				.withIndex('by_assignedPartnerId_and_status', (q) =>
					q.eq('assignedPartnerId', partner._id).eq('status', 'delivered')
				)
				.order('desc')
				.take(DELIVERED_WINDOW)
		]);
		const today = delivered.filter(
			(order) => order.deliveredAt !== undefined && istDayStartMs(order.deliveredAt) === args.dayStartMs
		);
		return {
			toPickUp: await Promise.all(packed.map((order) => toRunSummary(ctx, order))),
			onTheWay: await Promise.all(onTheWay.map((order) => toRunSummary(ctx, order))),
			deliveredToday: today.length,
			cashToHandOverPaise: today
				.filter((order) => order.cashSettledAt === undefined)
				.reduce((sum, order) => sum + (order.cashCollectedPaise ?? 0), 0)
		};
	}
});

const runDetail = v.object({
	_id: v.id('orders'),
	orderNumber: v.number(),
	status: orderStatus,
	paymentMethod,
	paymentStatus,
	totalPaise: v.number(),
	collectPaise: v.number(),
	/** Gone once the order is cancelled */
	area: v.optional(v.string()),
	/** Only while the order is open: after that the partner has no need of them */
	customer: v.optional(
		v.object({
			firstName: v.string(),
			phone: v.string(),
			line1: v.string(),
			landmark: v.optional(v.string()),
			lat: v.optional(v.number()),
			lng: v.optional(v.number()),
			mapsUrl: v.optional(v.string())
		})
	),
	/** After delivery the phone is only recognisable, not dialable */
	phoneLast4: v.optional(v.string()),
	customerNote: v.optional(v.string()),
	slotStartMs: v.optional(v.number()),
	items: v.array(v.object({ name: v.string(), unitLabel: v.string(), quantity: v.number() })),
	events: v.array(v.object({ status: orderStatus, at: v.number(), note: v.optional(v.string()) }))
});

/** One of my orders, or `null` when it is missing or not assigned to me (the two look the same) */
export const getRun = query({
	args: { orderId: v.string() },
	returns: v.union(v.null(), runDetail),
	handler: async (ctx, args) => {
		const { partner } = await requireDeliveryPartner(ctx);
		const order = await myOrder(ctx, partner._id, args.orderId);
		if (!order) return null;

		const [items, events] = await Promise.all([
			ctx.db
				.query('orderItems')
				.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
				.take(MAX_ITEMS_PER_ORDER),
			ctx.db
				.query('orderEvents')
				.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
				.take(50)
		]);
		const open = OPEN_FOR_PARTNER.includes(order.status);
		const { address } = order;
		return {
			_id: order._id,
			orderNumber: order.orderNumber,
			status: order.status,
			paymentMethod: order.paymentMethod,
			paymentStatus: order.paymentStatus,
			totalPaise: order.totalPaise,
			collectPaise: open ? amountToCollect(order) : 0,
			...(order.status !== 'cancelled' ? { area: address.area } : {}),
			...(open
				? {
						customer: {
							firstName: address.contactName.trim().split(/\s+/)[0],
							phone: address.contactPhone,
							line1: address.line1,
							landmark: address.landmark,
							lat: address.lat,
							lng: address.lng,
							mapsUrl: address.mapsUrl
						}
					}
				: {}),
			...(order.status === 'delivered' ? { phoneLast4: address.contactPhone.slice(-4) } : {}),
			customerNote: open ? order.customerNote : undefined,
			slotStartMs: open ? order.slotStartMs : undefined,
			items: items.map((item) => ({ name: item.name, unitLabel: item.unitLabel, quantity: item.quantity })),
			events: events.map((event) => ({ status: event.status, at: event._creationTime, note: event.note }))
		};
	}
});

/** Packed → Out for delivery. The order must be assigned to me. */
export const pickUp = mutation({
	args: { orderId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { partner } = await requireDeliveryPartner(ctx);
		const order = await myOrder(ctx, partner._id, args.orderId);
		if (!order) throw notFound();
		await transitionOrder(ctx, {
			orderId: order._id,
			to: 'out_for_delivery',
			actor: { kind: 'partner', id: partner._id }
		});
		return null;
	}
});

/**
 * Out for delivery → Delivered, once the customer's 4-digit code is typed correctly.
 *
 * A wrong code is a normal answer, not an error: throwing would roll back the guess counter and
 * make the limit worthless. At most 5 guesses per order in 10 minutes, right or wrong.
 *
 * `paidWith` says how the partner was actually paid (cash or UPI) and is required while the order
 * is unpaid. Only cash is added to what the partner owes the store.
 */
export const markDelivered = mutation({
	args: {
		orderId: v.string(),
		code: v.string(),
		paidWith: v.optional(v.union(v.literal('cash'), v.literal('upi')))
	},
	returns: v.union(
		v.object({ ok: v.literal(true) }),
		v.object({ ok: v.literal(false), reason: v.literal('WRONG_CODE') }),
		v.object({ ok: v.literal(false), reason: v.literal('TOO_MANY_ATTEMPTS'), retryAfterMs: v.number() })
	),
	handler: async (ctx, args) => {
		const { partner } = await requireDeliveryPartner(ctx);
		const order = await myOrder(ctx, partner._id, args.orderId);
		if (!order) throw notFound();
		if (order.status !== 'out_for_delivery') {
			throw new ConvexError({ code: 'INVALID_TRANSITION', from: order.status, to: 'delivered' });
		}
		const owes = order.paymentStatus === 'pending';
		if (owes && !args.paidWith) throw new ConvexError({ code: 'PAYMENT_REQUIRED' });

		const attempt = await deliveryRateLimiter.limit(ctx, 'deliveryCodeAttempt', { key: order._id });
		if (!attempt.ok) {
			return { ok: false as const, reason: 'TOO_MANY_ATTEMPTS' as const, retryAfterMs: attempt.retryAfter };
		}
		if (args.code.trim() !== order.deliveryCode) {
			return { ok: false as const, reason: 'WRONG_CODE' as const };
		}

		await transitionOrder(ctx, {
			orderId: order._id,
			to: 'delivered',
			actor: { kind: 'partner', id: partner._id }
		});
		if (owes) {
			await ctx.db.patch(order._id, {
				paymentStatus: 'paid',
				paidWith: args.paidWith,
				...(args.paidWith === 'cash' ? { cashCollectedPaise: order.totalPaise } : {})
			});
		}
		return { ok: true as const };
	}
});

/** Out for delivery → Delivery failed, with a reason from the short list. The admin takes it from here. */
export const markFailed = mutation({
	args: {
		orderId: v.string(),
		reason: v.union(
			v.literal('not_reachable'),
			v.literal('address_not_found'),
			v.literal('refused'),
			v.literal('other')
		)
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { partner } = await requireDeliveryPartner(ctx);
		const order = await myOrder(ctx, partner._id, args.orderId);
		if (!order) throw notFound();
		await transitionOrder(ctx, {
			orderId: order._id,
			to: 'delivery_failed',
			actor: { kind: 'partner', id: partner._id },
			note: DELIVERY_FAILURE_NOTES[args.reason]
		});
		return null;
	}
});
