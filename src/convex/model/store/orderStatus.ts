/**
 * The order state machine. Every status change goes through `transitionOrder`, which checks the
 * move is allowed, writes the `orderEvents` row and runs the side effects. Scattered
 * `ctx.db.patch(orderId, { status })` calls are how orders end up delivered and cancelled at once.
 *
 *   placed -> accepted -> packed -> out_for_delivery -> delivered
 *      |         |          |               |
 *      +---------+----------+               +-> delivery_failed -> (admin) cancelled / packed again
 *                 +-> cancelled
 *
 * WHO may make a move is the caller's business (customers cancel only while `placed`; partners
 * and admins do the rest). This module only knows what is physically possible.
 */
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { adjustStock } from './stock';

export type OrderStatus = Doc<'orders'>['status'];
export type ActorKind = Doc<'orderEvents'>['actorKind'];

export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
	placed: ['accepted', 'cancelled'],
	accepted: ['packed', 'cancelled'],
	packed: ['out_for_delivery', 'cancelled'],
	out_for_delivery: ['delivered', 'delivery_failed'],
	delivery_failed: ['cancelled', 'packed'],
	delivered: [],
	cancelled: []
};

/** Statuses an order can still leave: it is "open" until it reaches one of the other two */
export const OPEN_STATUSES: readonly OrderStatus[] = [
	'placed',
	'accepted',
	'packed',
	'out_for_delivery',
	'delivery_failed'
];

export const isOpenStatus = (status: OrderStatus) => OPEN_STATUSES.includes(status);

export const canTransition = (from: OrderStatus, to: OrderStatus) =>
	ALLOWED_TRANSITIONS[from].includes(to);

export async function transitionOrder(
	ctx: MutationCtx,
	args: {
		orderId: Id<'orders'>;
		to: OrderStatus;
		actor: { kind: ActorKind; id?: string };
		note?: string;
	}
) {
	const order = await ctx.db.get(args.orderId);
	if (!order) throw new ConvexError({ code: 'ORDER_NOT_FOUND' });
	if (!canTransition(order.status, args.to)) {
		throw new ConvexError({ code: 'INVALID_TRANSITION', from: order.status, to: args.to });
	}

	if (args.to === 'cancelled') {
		// The shelf gets the goods back. `cancelled` is terminal, so this can only happen once.
		const items = await ctx.db
			.query('orderItems')
			.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
			.take(200);
		for (const item of items) {
			await adjustStock(ctx, {
				productId: item.productId,
				delta: item.quantity,
				reason: 'order_cancelled',
				orderId: order._id,
				actorId: args.actor.id
			});
		}
	}

	await ctx.db.patch(order._id, {
		status: args.to,
		...(args.to === 'delivered' ? { deliveredAt: Date.now() } : {})
	});
	await ctx.db.insert('orderEvents', {
		orderId: order._id,
		status: args.to,
		actorKind: args.actor.kind,
		actorId: args.actor.id,
		note: args.note
	});
}
