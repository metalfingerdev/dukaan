/**
 * The only code that changes `products.stock`. Every change also writes a `stockAdjustments` row,
 * because when the shelf and the app disagree that log is the only way to find out why. Never
 * patch `stock` anywhere else. Convex mutations are transactions, so if a later step of the caller
 * fails (say, the second line of an order is out of stock), this change rolls back with it.
 */
import { ConvexError } from 'convex/values';
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';

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
