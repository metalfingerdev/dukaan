/**
 * The admin's live order board. Every function calls `requireAppAdmin`. Status changes go through
 * `transitionOrder`, which checks the move is allowed, writes the timeline event and, on a
 * cancel, puts the stock back. Two people moving the same order can't both win: the second move
 * is no longer a valid transition and is refused with `INVALID_TRANSITION`.
 *
 * Handing a packed order to a delivery partner arrives with the delivery-partner screens.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import type { QueryCtx } from '../../_generated/server';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import { transitionOrder } from '../../model/store/orderStatus';
import { orderStatus, paymentMethod, paymentStatus } from '../validators';

const BOARD_COLUMN_SIZE = 50;
const MAX_ITEMS_PER_ORDER = 50;
const MAX_REASON_LENGTH = 200;

const boardStatus = v.union(
	v.literal('placed'),
	v.literal('accepted'),
	v.literal('packed'),
	v.literal('out_for_delivery')
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
 * Rejects or cancels an order that has not left the store (New, Accepted or Packed) and puts its
 * stock back. The reason is required and is shown to the customer on their order timeline.
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
