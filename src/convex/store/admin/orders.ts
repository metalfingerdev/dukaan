/**
 * The admin's live order board. Every function calls `requireAppAdmin`. Status changes go through
 * `transitionOrder`, which checks the move is allowed, writes the timeline event and, on a
 * cancel, puts the stock back. Two people moving the same order can't both win: the second move
 * is no longer a valid transition and is refused with `INVALID_TRANSITION`.
 *
 * A packed order is handed to a delivery partner in two taps: `assignPartner` (changeable until
 * it leaves), then `startDelivery`. The partner screens can later start the run themselves.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import type { QueryCtx } from '../../_generated/server';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import { transitionOrder } from '../../model/store/orderStatus';
import { invoiceView, orderStatus, paidWith, paymentMethod, paymentStatus } from '../validators';
import { invoiceFor } from '../../model/store/invoice';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';

const BOARD_COLUMN_SIZE = 50;
const MAX_ITEMS_PER_ORDER = 50;
const MAX_REASON_LENGTH = 200;

const boardStatus = v.union(
	v.literal('placed'),
	v.literal('accepted'),
	v.literal('packed'),
	v.literal('out_for_delivery'),
	v.literal('delivery_failed')
);

const boardOrder = v.object({
	_id: v.id('orders'),
	orderNumber: v.number(),
	status: orderStatus,
	placedAt: v.number(),
	totalPaise: v.number(),
	paymentMethod,
	paymentStatus,
	area: v.string(),
	landmark: v.optional(v.string()),
	contactName: v.string(),
	contactPhone: v.string(),
	slotStartMs: v.optional(v.number()),
	customerNote: v.optional(v.string()),
	/** False only for orders placed before pins were required: the rider must call to find them */
	hasPin: v.boolean(),
	assignedPartnerId: v.optional(v.id('deliveryPartners')),
	assignedPartnerName: v.optional(v.string()),
	/** Why the delivery failed, for orders in the Failed column */
	failureNote: v.optional(v.string()),
	itemCount: v.number(),
	items: v.array(v.object({ name: v.string(), unitLabel: v.string(), quantity: v.number() }))
});

const toBoardOrder = async (
	ctx: Pick<QueryCtx, 'db'>,
	order: Doc<'orders'>
) => {
	const items = await ctx.db
		.query('orderItems')
		.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
		.take(MAX_ITEMS_PER_ORDER);
	const partner = order.assignedPartnerId ? await ctx.db.get(order.assignedPartnerId) : null;
	const failureNote =
		order.status === 'delivery_failed'
			? (
					await ctx.db
						.query('orderEvents')
						.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
						.order('desc')
						.first()
				)?.note
			: undefined;
	return {
		_id: order._id,
		orderNumber: order.orderNumber,
		status: order.status,
		placedAt: order._creationTime,
		totalPaise: order.totalPaise,
		paymentMethod: order.paymentMethod,
		paymentStatus: order.paymentStatus,
		area: order.address.area,
		landmark: order.address.landmark,
		contactName: order.address.contactName,
		contactPhone: order.address.contactPhone,
		slotStartMs: order.slotStartMs,
		customerNote: order.customerNote,
		hasPin: order.address.lat !== undefined && order.address.lng !== undefined,
		assignedPartnerId: order.assignedPartnerId,
		assignedPartnerName: partner?.name,
		failureNote,
		itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
		items: items.map((item) => ({
			name: item.name,
			unitLabel: item.unitLabel,
			quantity: item.quantity
		}))
	};
};

/** The orders in one board column, oldest first (the one to pack next is on top). At most 50. */
export const listOrders = query({
	args: { status: boardStatus },
	returns: v.array(boardOrder),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const orders = await ctx.db
			.query('orders')
			.withIndex('by_status', (q) => q.eq('status', args.status))
			.take(BOARD_COLUMN_SIZE);
		return await Promise.all(orders.map((order) => toBoardOrder(ctx, order)));
	}
});

/** New → Accepted */
export const acceptOrder = mutation({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		await transitionOrder(ctx, {
			orderId: args.orderId,
			to: 'accepted',
			actor: { kind: 'admin', id: admin._id }
		});
		return null;
	}
});

/** Accepted → Packed */
export const packOrder = mutation({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		await transitionOrder(ctx, {
			orderId: args.orderId,
			to: 'packed',
			actor: { kind: 'admin', id: admin._id }
		});
		return null;
	}
});

/**
 * Rejects or cancels an order that is not out on the road (New, Accepted, Packed, or Failed after
 * a delivery attempt) and puts its stock back. The reason is required and is shown to the customer on their order timeline.
 */
export const cancelOrder = mutation({
	args: { orderId: v.id('orders'), reason: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		const reason = args.reason.trim().replace(/\s+/g, ' ');
		if (reason.length === 0 || reason.length > MAX_REASON_LENGTH) {
			throw new ConvexError({ code: 'INVALID_REASON' });
		}
		await transitionOrder(ctx, {
			orderId: args.orderId,
			to: 'cancelled',
			actor: { kind: 'admin', id: admin._id },
			note: reason
		});
		return null;
	}
});

/** Chooses (or changes) the partner for a packed order. Throws `NOT_PACKED` or `PARTNER_NOT_FOUND`. */
export const assignPartner = mutation({
	args: { orderId: v.id('orders'), partnerId: v.id('deliveryPartners') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const order = await ctx.db.get(args.orderId);
		if (!order) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });
		if (order.status !== 'packed') throw new ConvexError({ code: 'NOT_PACKED' });
		const partner = await ctx.db.get(args.partnerId);
		if (!partner || !partner.isActive) throw new ConvexError({ code: 'PARTNER_NOT_FOUND' });
		await ctx.db.patch(order._id, { assignedPartnerId: partner._id });
		return null;
	}
});

/** Packed → Out for delivery, with the partner already chosen. Throws `NO_PARTNER` without one. */
export const startDelivery = mutation({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		const order = await ctx.db.get(args.orderId);
		if (!order) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });
		const partner = order.assignedPartnerId ? await ctx.db.get(order.assignedPartnerId) : null;
		if (!partner || !partner.isActive) throw new ConvexError({ code: 'NO_PARTNER' });
		await transitionOrder(ctx, {
			orderId: order._id,
			to: 'out_for_delivery',
			actor: { kind: 'admin', id: admin._id }
		});
		return null;
	}
});

/** Failed → Packed: try the delivery again (with the same or another partner) */
export const repackOrder = mutation({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		await transitionOrder(ctx, {
			orderId: args.orderId,
			to: 'packed',
			actor: { kind: 'admin', id: admin._id }
		});
		return null;
	}
});

/** Any order's invoice, for the admin; `null` before delivery */
export const getInvoice = query({
	args: { orderId: v.string() },
	returns: v.union(v.null(), invoiceView),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const id = ctx.db.normalizeId('orders', args.orderId);
		const order = id ? await ctx.db.get(id) : null;
		return order ? await invoiceFor(ctx, order) : null;
	}
});

/** Delivered orders, newest first, a page at a time: where the admin finds invoices */
export const listDelivered = query({
	args: { paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(
		v.object({
			_id: v.id('orders'),
			orderNumber: v.number(),
			deliveredAt: v.optional(v.number()),
			totalPaise: v.number(),
			paymentMethod,
			paidWith: v.optional(paidWith),
			contactName: v.string(),
			area: v.string(),
			invoiceNumber: v.optional(v.string())
		})
	),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const page = await ctx.db
			.query('orders')
			.withIndex('by_status', (q) => q.eq('status', 'delivered'))
			.order('desc')
			.paginate(args.paginationOpts);
		return {
			...page,
			page: page.page.map((order) => ({
				_id: order._id,
				orderNumber: order.orderNumber,
				deliveredAt: order.deliveredAt,
				totalPaise: order.totalPaise,
				paymentMethod: order.paymentMethod,
				paidWith: order.paidWith,
				contactName: order.address.contactName,
				area: order.address.area,
				invoiceNumber: order.invoiceNumber
			}))
		};
	}
});
