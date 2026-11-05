/**
 * A customer's orders: placing one, cancelling one, and reading their own. Every function calls
 * `requireCustomer` and takes no user id. `placeOrder` is where money and stock correctness live,
 * so it trusts nothing from the browser except the customer's choices (address, slot, payment
 * method, note): the cart is read from the database, prices come from the database, and the
 * total the customer saw is only compared, never used.
 * See .agents/skills/store-app/references/customer.md and data-model.md.
 */
import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import type { Id } from '../_generated/dataModel';
import { mutation, query } from '../_generated/server';
import { requireCustomer } from '../model/store/access';
import { nextCounterValue } from '../model/store/counters';
import { randomDeliveryCode } from '../model/store/deliveryCode';
import { isOpenStatus, transitionOrder } from '../model/store/orderStatus';
import { priceCart } from '../model/store/pricing';
import { isProductVisible, maxQuantityFor } from '../model/store/publicProjection';
import { isInIndia } from '../model/store/address';
import { invoiceFor } from '../model/store/invoice';
import { beginOnlinePayment, onlinePaymentFor, onlinePaymentView } from './payments';
import { upiQrFor, upiQrView } from './upi';
import { isValidSlot } from '../model/store/slots';
import { adjustStock } from '../model/store/stock';
import { isOpenNow } from '../model/store/time';
import { MAX_OPEN_ORDERS, orderRateLimiter } from './rateLimits';
import { invoiceView, orderStatus, paymentMethod, paymentStatus } from './validators';

const MAX_NOTE_LENGTH = 300;
const MAX_CART_LINES = 100;
// How many of the newest orders to look at when counting open ones: bounded, and open orders are
// always among the newest
const OPEN_ORDER_LOOKBACK = 20;

type CartProblem = {
	productId: Id<'products'>;
	reason: 'unavailable' | 'out_of_stock' | 'over_limit';
	/** The most that can be ordered right now */
	available: number;
};

/**
 * Turns the customer's saved cart into an order, or throws `ConvexError({ code })`:
 *
 * - `STORE_NOT_SET_UP`, `STORE_CLOSED`, `TOO_MANY_OPEN_ORDERS`
 * - `ADDRESS_NOT_FOUND` (missing or not theirs), `OUT_OF_AREA`, `PIN_REQUIRED` (saved before pins
 *   were required), `INVALID_SLOT`, `INVALID_NOTE`
 * - `EMPTY_CART`
 * - `CART_CHANGED` with `problems`: every line that can no longer be ordered as it is
 * - `PRICE_CHANGED` with `totalPaise`: the total differs from the one the customer saw
 * - `BELOW_MINIMUM` with `minOrderPaise`
 *
 * One transaction: a failure anywhere leaves no order, no stock change and the cart as it was.
 * Retrying with the same `idempotencyKey` returns the original order instead of a second one.
 */
export const placeOrder = mutation({
	args: {
		addressId: v.id('addresses'),
		// Start of a delivery slot from `listSlots`; unset means "as soon as possible"
		slotStartMs: v.optional(v.number()),
		paymentMethod,
		note: v.optional(v.string()),
		// One per checkout attempt, generated when the page opens
		idempotencyKey: v.string(),
		// What the customer saw; compared with the recomputed total, never trusted
		expectedTotalPaise: v.number()
	},
	returns: v.object({
		orderId: v.id('orders'),
		orderNumber: v.number(),
		alreadyPlaced: v.boolean()
	}),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const userId: string = user._id;

		if (args.idempotencyKey.length < 8 || args.idempotencyKey.length > 64) {
			throw new ConvexError({ code: 'INVALID_IDEMPOTENCY_KEY' });
		}
		const existing = await ctx.db
			.query('orders')
			.withIndex('by_userId_and_idempotencyKey', (q) =>
				q.eq('userId', userId).eq('idempotencyKey', args.idempotencyKey)
			)
			.unique();
		// A double tap or a retry after a lost response: hand back the order that already exists
		if (existing) {
			return { orderId: existing._id, orderNumber: existing.orderNumber, alreadyPlaced: true };
		}

		await orderRateLimiter.limit(ctx, 'placeOrderPerUser', { key: userId, throws: true });

		const settings = await ctx.db.query('storeSettings').first();
		if (!settings) throw new ConvexError({ code: 'STORE_NOT_SET_UP' });
		const now = Date.now();
		if (!isOpenNow(settings, now)) throw new ConvexError({ code: 'STORE_CLOSED' });

		const recent = await ctx.db
			.query('orders')
			.withIndex('by_userId', (q) => q.eq('userId', userId))
			.order('desc')
			.take(OPEN_ORDER_LOOKBACK);
		if (recent.filter((order) => isOpenStatus(order.status)).length >= MAX_OPEN_ORDERS) {
			throw new ConvexError({ code: 'TOO_MANY_OPEN_ORDERS', max: MAX_OPEN_ORDERS });
		}

		// The address must be theirs and still in an area we deliver to; one answer for "missing"
		// and "someone else's"
		const address = await ctx.db.get(args.addressId);
		if (!address || address.userId !== userId) throw new ConvexError({ code: 'ADDRESS_NOT_FOUND' });
		if (!settings.deliveryAreas.includes(address.area)) throw new ConvexError({ code: 'OUT_OF_AREA' });
		if (address.lat === undefined || address.lng === undefined) throw new ConvexError({ code: 'PIN_REQUIRED' });

		if (args.slotStartMs !== undefined && !isValidSlot(settings, now, args.slotStartMs)) {
			throw new ConvexError({ code: 'INVALID_SLOT' });
		}

		const note = args.note?.trim();
		if (note !== undefined && note.length > MAX_NOTE_LENGTH) {
			throw new ConvexError({ code: 'INVALID_NOTE' });
		}

		// The cart comes from the database. Whatever lines or prices the browser holds don't matter.
		const cartLines = await ctx.db
			.query('cartItems')
			.withIndex('by_userId_and_productId', (q) => q.eq('userId', userId))
			.take(MAX_CART_LINES);
		if (cartLines.length === 0) throw new ConvexError({ code: 'EMPTY_CART' });

		const lines = [];
		const problems: CartProblem[] = [];
		for (const cartLine of cartLines) {
			const product = await ctx.db.get(cartLine.productId);
			if (!product || !(await isProductVisible(ctx, product))) {
				problems.push({ productId: cartLine.productId, reason: 'unavailable', available: 0 });
			} else if (cartLine.quantity > product.stock) {
				problems.push({
					productId: product._id,
					reason: 'out_of_stock',
					available: maxQuantityFor(product)
				});
			} else if (cartLine.quantity > product.maxPerOrder) {
				problems.push({ productId: product._id, reason: 'over_limit', available: product.maxPerOrder });
			} else {
				lines.push({ product, quantity: cartLine.quantity });
			}
		}
		if (problems.length > 0) throw new ConvexError({ code: 'CART_CHANGED', problems });

		const pricing = priceCart(
			lines.map(({ product, quantity }) => ({
				pricePaise: product.pricePaise,
				mrpPaise: product.mrpPaise,
				quantity
			})),
			settings
		);
		if (pricing.totalPaise !== args.expectedTotalPaise) {
			throw new ConvexError({ code: 'PRICE_CHANGED', totalPaise: pricing.totalPaise });
		}
		if (pricing.subtotalPaise < settings.minOrderPaise) {
			throw new ConvexError({ code: 'BELOW_MINIMUM', minOrderPaise: settings.minOrderPaise });
		}

		const online = args.paymentMethod === 'online';
		const orderNumber = await nextCounterValue(ctx, 'order');
		const orderId = await ctx.db.insert('orders', {
			orderNumber,
			userId,
			idempotencyKey: args.idempotencyKey,
			// Paying online: off the board until Razorpay confirms the payment
			status: online ? 'awaiting_payment' : 'placed',
			paymentMethod: args.paymentMethod,
			paymentStatus: 'pending',
			subtotalPaise: pricing.subtotalPaise,
			savingsPaise: pricing.savingsPaise,
			deliveryFeePaise: pricing.deliveryFeePaise,
			smallCartFeePaise: pricing.smallCartFeePaise,
			totalPaise: pricing.totalPaise,
			// A snapshot: editing the saved address later must not change where this order goes
			address: {
				kind: address.kind,
				line1: address.line1,
				area: address.area,
				landmark: address.landmark,
				contactName: address.contactName,
				contactPhone: address.contactPhone,
				lat: address.lat,
				lng: address.lng,
				mapsUrl: address.mapsUrl
			},
			slotStartMs: args.slotStartMs,
			customerNote: note || undefined,
			deliveryCode: randomDeliveryCode()
		});

		for (const { product, quantity } of lines) {
			// Snapshots: editing a product later must not rewrite this order or its invoice
			await ctx.db.insert('orderItems', {
				orderId,
				productId: product._id,
				name: product.name,
				unitLabel: product.unitLabel,
				unitPricePaise: product.pricePaise,
				mrpPaise: product.mrpPaise,
				quantity,
				gstRatePercent: product.gstRatePercent,
				hsn: product.hsn
			});
			await adjustStock(ctx, {
				productId: product._id,
				delta: -quantity,
				reason: 'sold',
				orderId,
				actorId: userId
			});
		}

		await ctx.db.insert('orderEvents', {
			orderId,
			status: online ? 'awaiting_payment' : 'placed',
			actorKind: 'customer',
			actorId: userId
		});
		// The stock is held from now; if the payment doesn't come in time the order is cancelled
		if (online) await beginOnlinePayment(ctx, orderId, pricing.totalPaise);

		for (const cartLine of cartLines) await ctx.db.delete(cartLine._id);

		return { orderId, orderNumber, alreadyPlaced: false };
	}
});

/**
 * The customer cancels their own order, which they may do only while it is still `placed` (or
 * waiting for its online payment). Stock goes back on the shelf, and money paid online is refunded. Cancelling twice is harmless: the second call changes nothing.
 */
export const cancelOrder = mutation({
	args: { orderId: v.string() },
	returns: v.object({ status: v.literal('cancelled') }),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const id = ctx.db.normalizeId('orders', args.orderId);
		const order = id ? await ctx.db.get(id) : null;
		// Missing, malformed and someone else's order all get the same answer
		if (!order || order.userId !== user._id) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });

		if (order.status === 'cancelled') return { status: 'cancelled' as const };
		if (order.status !== 'placed' && order.status !== 'awaiting_payment') {
			throw new ConvexError({ code: 'CANNOT_CANCEL', status: order.status });
		}
		await transitionOrder(ctx, {
			orderId: order._id,
			to: 'cancelled',
			actor: { kind: 'customer', id: user._id },
			note: 'Cancelled by the customer'
		});
		return { status: 'cancelled' as const };
	}
});

const OPEN_FOR_CODE = ['placed', 'accepted', 'packed', 'out_for_delivery'];

const orderDetail = v.object({
	_id: v.id('orders'),
	orderNumber: v.number(),
	status: orderStatus,
	paymentMethod,
	paymentStatus,
	subtotalPaise: v.number(),
	savingsPaise: v.number(),
	deliveryFeePaise: v.number(),
	smallCartFeePaise: v.number(),
	totalPaise: v.number(),
	address: v.object({
		kind: v.union(v.literal('house'), v.literal('hostel'), v.literal('shop')),
		line1: v.string(),
		area: v.string(),
		landmark: v.optional(v.string()),
		contactName: v.string(),
		contactPhone: v.string(),
		hasPin: v.boolean()
	}),
	slotStartMs: v.optional(v.number()),
	customerNote: v.optional(v.string()),
	placedAt: v.number(),
	deliveredAt: v.optional(v.number()),
	invoiceNumber: v.optional(v.string()),
	// Only while the order is open: the customer reads it out to the delivery partner
	deliveryCode: v.optional(v.string()),
	// The delivery partner the customer may phone, only while the order is out for delivery
	partner: v.optional(v.object({ name: v.string(), phoneNumber: v.string() })),
	// The Razorpay UPI QR, while the order is out for delivery
	upiQr: v.optional(upiQrView),
	// Paying online: what the page needs to open Razorpay Checkout
	onlinePayment: v.optional(onlinePaymentView),
	// Money going back for a cancelled order paid through Razorpay
	refundStatus: v.optional(v.union(v.literal('requesting'), v.literal('pending'), v.literal('processed'), v.literal('failed'))),
	items: v.array(
		v.object({
			name: v.string(),
			unitLabel: v.string(),
			unitPricePaise: v.number(),
			mrpPaise: v.number(),
			quantity: v.number()
		})
	),
	events: v.array(
		v.object({
			status: orderStatus,
			actorKind: v.union(
				v.literal('customer'),
				v.literal('admin'),
				v.literal('partner'),
				v.literal('system')
			),
			note: v.optional(v.string()),
			at: v.number()
		})
	)
});

/**
 * One of the customer's own orders with its items and timeline, or `null` when the id is
 * malformed, unknown or someone else's. A purpose-built projection: no user id, idempotency key or
 * cash fields. The assigned partner's name and phone appear only while the order is out for
 * delivery, so a number is never left on an old order.
 */
export const getOrder = query({
	args: { orderId: v.string() },
	returns: v.union(v.null(), orderDetail),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const id = ctx.db.normalizeId('orders', args.orderId);
		const order = id ? await ctx.db.get(id) : null;
		if (!order || order.userId !== user._id) return null;

		const [items, events] = await Promise.all([
			ctx.db
				.query('orderItems')
				.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
				.take(MAX_CART_LINES),
			ctx.db
				.query('orderEvents')
				.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
				.take(50)
		]);

		const partnerDoc =
			order.status === 'out_for_delivery' && order.assignedPartnerId
				? await ctx.db.get(order.assignedPartnerId)
				: null;

		return {
			_id: order._id,
			orderNumber: order.orderNumber,
			status: order.status,
			paymentMethod: order.paymentMethod,
			paymentStatus: order.paymentStatus,
			subtotalPaise: order.subtotalPaise,
			savingsPaise: order.savingsPaise,
			deliveryFeePaise: order.deliveryFeePaise,
			smallCartFeePaise: order.smallCartFeePaise,
			totalPaise: order.totalPaise,
			address: {
				kind: order.address.kind,
				line1: order.address.line1,
				area: order.address.area,
				landmark: order.address.landmark,
				contactName: order.address.contactName,
				contactPhone: order.address.contactPhone,
				hasPin: order.address.lat !== undefined && order.address.lng !== undefined
			},
			...(partnerDoc ? { partner: { name: partnerDoc.name, phoneNumber: partnerDoc.phoneNumber } } : {}),
			slotStartMs: order.slotStartMs,
			customerNote: order.customerNote,
			placedAt: order._creationTime,
			deliveredAt: order.deliveredAt,
			invoiceNumber: order.invoiceNumber,
			...(OPEN_FOR_CODE.includes(order.status) ? { deliveryCode: order.deliveryCode } : {}),
			upiQr: order.status === 'out_for_delivery' ? await upiQrFor(ctx, order._id) : undefined,
			onlinePayment: await onlinePaymentFor(ctx, order),
			refundStatus: order.refund?.status,
			items: items.map((item) => ({
				name: item.name,
				unitLabel: item.unitLabel,
				unitPricePaise: item.unitPricePaise,
				mrpPaise: item.mrpPaise,
				quantity: item.quantity
			})),
			events: events.map((event) => ({
				status: event.status,
				actorKind: event.actorKind,
				note: event.note,
				at: event._creationTime
			}))
		};
	}
});

const orderSummary = v.object({
	_id: v.id('orders'),
	orderNumber: v.number(),
	status: orderStatus,
	totalPaise: v.number(),
	placedAt: v.number()
});

/** The customer's orders, newest first */
export const listMyOrders = query({
	args: { paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(orderSummary),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const result = await ctx.db
			.query('orders')
			.withIndex('by_userId', (q) => q.eq('userId', user._id))
			.order('desc')
			.paginate(args.paginationOpts);
		return {
			...result,
			page: result.page.map((order) => ({
				_id: order._id,
				orderNumber: order.orderNumber,
				status: order.status,
				totalPaise: order.totalPaise,
				placedAt: order._creationTime
			}))
		};
	}
});

/** Statuses in which the customer can still move the pin: the order hasn't reached them yet */
const PIN_MOVABLE = ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivery_failed'];

/**
 * Moves the pin of one of the customer's open orders, for when the rider can't find them: they
 * stand at the door and send their current location. Only the order's snapshot changes, and the
 * rider's screen follows live. Throws `ORDER_NOT_FOUND` (missing or not theirs), `ORDER_CLOSED` or
 * `INVALID_ADDRESS` with `field: 'location'`.
 */
export const updateOrderPin = mutation({
	args: { orderId: v.string(), lat: v.number(), lng: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const id = ctx.db.normalizeId('orders', args.orderId);
		const order = id ? await ctx.db.get(id) : null;
		if (!order || order.userId !== user._id) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });
		if (!PIN_MOVABLE.includes(order.status)) throw new ConvexError({ code: 'ORDER_CLOSED' });
		if (!isInIndia(args)) throw new ConvexError({ code: 'INVALID_ADDRESS', field: 'location' });
		await ctx.db.patch(order._id, {
			address: { ...order.address, lat: args.lat, lng: args.lng },
			pinUpdatedAt: Date.now()
		});
		return null;
	}
});

/** The invoice of one of the customer's own delivered orders, or `null` (not delivered, not theirs, or missing) */
export const getInvoice = query({
	args: { orderId: v.string() },
	returns: v.union(v.null(), invoiceView),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const id = ctx.db.normalizeId('orders', args.orderId);
		const order = id ? await ctx.db.get(id) : null;
		if (!order || order.userId !== user._id) return null;
		return await invoiceFor(ctx, order);
	}
});
