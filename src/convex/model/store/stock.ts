/**
 * The only code that changes `products.stock`. Every change also writes a `stockAdjustments` row,
 * because when the shelf and the app disagree that log is the only way to find out why. Never
 * patch `stock` anywhere else. Convex mutations are transactions, so if a later step of the caller
 * fails (say, the second line of an order is out of stock), this change rolls back with it.
 */
import { ConvexError } from 'convex/values';
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';

export type StockReason = 'received' | 'sold' | 'order_cancelled' | 'damaged' | 'correction';

export async function adjustStock(
	ctx: MutationCtx,
	args: {
		productId: Id<'products'>;
		/** Negative for sales and write-offs, positive for deliveries and restocks */
		delta: number;
		reason: StockReason;
		orderId?: Id<'orders'>;
		actorId?: string;
	}
) {
	if (!Number.isSafeInteger(args.delta) || args.delta === 0) {
		throw new ConvexError({ code: 'INVALID_STOCK_CHANGE', productId: args.productId });
	}
	const product = await ctx.db.get(args.productId);
	if (!product) throw new ConvexError({ code: 'PRODUCT_NOT_FOUND', productId: args.productId });

	const stockAfter = product.stock + args.delta;
	if (stockAfter < 0) throw new ConvexError({ code: 'OUT_OF_STOCK', productId: args.productId });

	await ctx.db.patch(args.productId, { stock: stockAfter });
	await ctx.db.insert('stockAdjustments', { ...args, stockAfter });
	return stockAfter;
}

// Open orders to look at when working out what is still on the shelf. A small store has a handful;
// more than this and the count is refused rather than computed from a partial view.
const MAX_HELD_ORDERS = 200;
const MAX_ORDER_LINES = 200;

/**
 * How many units of a product are in `placed` or `accepted` orders. Their stock was already taken
 * off `products.stock` when the order was placed, but nobody has picked the goods yet, so they are
 * still physically on the shelf: a shelf count of N means `stock` should be N minus this.
 * Packed orders are not counted, because their goods are already off the shelf.
 */
export async function heldByOpenOrders(ctx: QueryCtx | MutationCtx, productId: Id<'products'>) {
	let held = 0;
	for (const status of ['placed', 'accepted'] as const) {
		const orders = await ctx.db
			.query('orders')
			.withIndex('by_status', (q) => q.eq('status', status))
			.take(MAX_HELD_ORDERS + 1);
		if (orders.length > MAX_HELD_ORDERS) throw new ConvexError({ code: 'TOO_MANY_OPEN_ORDERS_TO_COUNT' });
		for (const order of orders) {
			const items = await ctx.db
				.query('orderItems')
				.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
				.take(MAX_ORDER_LINES);
			for (const item of items) if (item.productId === productId) held += item.quantity;
		}
	}
	return held;
}
