/**
 * The stock screen's functions. Every function calls `requireAppAdmin`, and every change to
 * `products.stock` goes through `adjustStock`, so each one leaves a `stockAdjustments` row with
 * its reason and who made it. That log is how a mismatch between the shelf and the app gets traced.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import { PRODUCT_LIMITS } from '../../model/store/product';
import { adjustStock, heldByOpenOrders } from '../../model/store/stock';
import { stockAdjustmentReason } from '../validators';
import { adminProduct, toAdminProduct } from './products';

const MAX_LIST = 200;
const HISTORY_LENGTH = 20;

const isQuantity = (n: number) =>
	Number.isSafeInteger(n) && n >= 1 && n <= PRODUCT_LIMITS.maxOpeningStock;

const invalidQuantity = () => new ConvexError({ code: 'INVALID_QUANTITY' });

/** Goods arrived: adds to the shelf */
export const receiveStock = mutation({
	args: { productId: v.id('products'), quantity: v.number() },
	returns: v.number(),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		if (!isQuantity(args.quantity)) throw invalidQuantity();
		return await adjustStock(ctx, {
			productId: args.productId,
			delta: args.quantity,
			reason: 'received',
			actorId: admin._id
		});
	}
});

/** Goods spoiled, broken or lost: removes from the shelf. Refused (`OUT_OF_STOCK`) below zero. */
export const writeOff = mutation({
	args: { productId: v.id('products'), quantity: v.number() },
	returns: v.number(),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		if (!isQuantity(args.quantity)) throw invalidQuantity();
		return await adjustStock(ctx, {
			productId: args.productId,
			delta: -args.quantity,
			reason: 'damaged',
			actorId: admin._id
		});
	}
});

/**
 * A physical count of the shelf. Placed and accepted orders have not been picked yet, so their
 * items are still on the shelf but already out of `stock`; the new stock is the count minus those.
 * `expectedStock` is what the admin saw when they started counting: if an order or another change
 * moved the stock since, the call is refused with `STOCK_CHANGED` instead of applying a stale
 * count. A count lower than what open orders hold is refused with `COUNT_BELOW_HELD`.
 */
export const setCountedStock = mutation({
	args: { productId: v.id('products'), counted: v.number(), expectedStock: v.number() },
	returns: v.object({ stock: v.number(), held: v.number() }),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		if (!Number.isSafeInteger(args.counted) || args.counted < 0 || args.counted > PRODUCT_LIMITS.maxOpeningStock) {
			throw invalidQuantity();
		}
		const product = await ctx.db.get(args.productId);
		if (!product) throw new ConvexError({ code: 'PRODUCT_NOT_FOUND' });
		if (product.stock !== args.expectedStock) {
			throw new ConvexError({ code: 'STOCK_CHANGED', stock: product.stock });
		}
		const held = await heldByOpenOrders(ctx, product._id);
		const stock = args.counted - held;
		if (stock < 0) throw new ConvexError({ code: 'COUNT_BELOW_HELD', held });
		if (stock !== product.stock) {
			await adjustStock(ctx, {
				productId: product._id,
				delta: stock - product.stock,
				reason: 'correction',
				actorId: admin._id
			});
		}
		return { stock, held };
	}
});

/** Units in placed and accepted orders: still on the shelf, already out of stock */
export const heldStock = query({
	args: { productId: v.id('products') },
	returns: v.number(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		return await heldByOpenOrders(ctx, args.productId);
	}
});

/** Products at zero stock, hidden ones included */
export const listOutOfStock = query({
	args: {},
	returns: v.array(adminProduct),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const products = await ctx.db
			.query('products')
			.withIndex('by_stock', (q) => q.eq('stock', 0))
			.take(MAX_LIST);
		return await Promise.all(products.map((product) => toAdminProduct(ctx, product)));
	}
});

/**
 * Products that have some stock but at or below their own "only few left" level. The level is
 * per product, so the index narrows to the largest possible level and the rest is checked here.
 */
export const listLowStock = query({
	args: {},
	returns: v.array(adminProduct),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const candidates = await ctx.db
			.query('products')
			.withIndex('by_stock', (q) => q.gt('stock', 0).lte('stock', PRODUCT_LIMITS.maxLowStockAt))
			.take(MAX_LIST);
		const low = candidates.filter(
			(product: Doc<'products'>) => product.lowStockAt !== undefined && product.stock <= product.lowStockAt
		);
		return await Promise.all(low.map((product) => toAdminProduct(ctx, product)));
	}
});

/** The newest changes to one product's stock */
export const stockHistory = query({
	args: { productId: v.id('products') },
	returns: v.array(
		v.object({
			_id: v.id('stockAdjustments'),
			at: v.number(),
			delta: v.number(),
			stockAfter: v.number(),
			reason: stockAdjustmentReason
		})
	),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const rows = await ctx.db
			.query('stockAdjustments')
			.withIndex('by_productId', (q) => q.eq('productId', args.productId))
			.order('desc')
			.take(HISTORY_LENGTH);
		return rows.map((row) => ({
			_id: row._id,
			at: row._creationTime,
			delta: row.delta,
			stockAfter: row.stockAfter,
			reason: row.reason
		}));
	}
});
