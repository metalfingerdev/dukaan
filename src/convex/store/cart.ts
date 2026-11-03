/**
 * A signed-in customer's cart. Every function calls `requireCustomer` and takes no user id: the
 * cart belongs to whoever is signed in. The client's quantities are requests; the server clamps
 * each line to what the shelf and the per-order limit allow. Prices are never stored here; the
 * cart shows live prices and `placeOrder` recomputes them from the database.
 * See .agents/skills/store-app/references/customer.md.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { mutation, query } from '../_generated/server';
import { requireCustomer } from '../model/store/access';
import { maxQuantityFor, publicProduct, toPublicProduct } from '../model/store/publicProjection';

const MAX_CART_LINES = 100;
const MAX_MERGE_LINES = 50;

const cartLine = v.object({
	productId: v.id('products'),
	quantity: v.number(),
	product: publicProduct
});

const findLine = (ctx: MutationCtx, userId: string, productId: Doc<'products'>['_id']) =>
	ctx.db
		.query('cartItems')
		.withIndex('by_userId_and_productId', (q) => q.eq('userId', userId).eq('productId', productId))
		.unique();

const isWholeNumber = (value: number) => Number.isSafeInteger(value) && value >= 0;

/**
 * The signed-in customer's lines with current product details. Hidden or deleted products are
 * left out. `quantity` is what is stored; the product's `maxQuantity` may now be lower (stock
 * dropped), so the UI shows the smaller of the two.
 */
export const getCart = query({
	args: {},
	returns: v.array(cartLine),
	handler: async (ctx) => {
		const user = await requireCustomer(ctx);
		const lines = await ctx.db
			.query('cartItems')
			.withIndex('by_userId_and_productId', (q) => q.eq('userId', user._id))
			.take(MAX_CART_LINES);
		const resolved = await Promise.all(
			lines.map(async (line) => {
				const product = await ctx.db.get(line.productId);
				if (!product || !product.isActive) return null;
				return {
					productId: line.productId,
					quantity: line.quantity,
					product: await toPublicProduct(ctx, product)
				};
			})
		);
		return resolved.filter((line) => line !== null);
	}
});

/**
 * Sets one line to `quantity` (0 removes it), clamped to what is available. Returns the quantity
 * actually stored and why it may differ from the request, so the UI can say "Only 3 available".
 * A product that is hidden or sold out is reported in the result, not thrown: an error would roll
 * back the removal of the stale line, which is exactly what should happen.
 */
export const setQuantity = mutation({
	args: { productId: v.id('products'), quantity: v.number() },
	returns: v.object({
		quantity: v.number(),
		status: v.union(
			v.literal('ok'),
			v.literal('clamped'),
			v.literal('out_of_stock'),
			v.literal('unavailable')
		)
	}),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		if (!isWholeNumber(args.quantity)) throw new ConvexError({ code: 'INVALID_QUANTITY' });
		const existing = await findLine(ctx, user._id, args.productId);

		if (args.quantity === 0) {
			if (existing) await ctx.db.delete(existing._id);
			return { quantity: 0, status: 'ok' as const };
		}

		const product = await ctx.db.get(args.productId);
		if (!product || !product.isActive) {
			if (existing) await ctx.db.delete(existing._id);
			return { quantity: 0, status: 'unavailable' as const };
		}
		const limit = maxQuantityFor(product);
		if (limit === 0) {
			if (existing) await ctx.db.delete(existing._id);
			return { quantity: 0, status: 'out_of_stock' as const };
		}
		const allowed = Math.min(args.quantity, limit);

		if (existing) {
			await ctx.db.patch(existing._id, { quantity: allowed });
		} else {
			const count = (
				await ctx.db
					.query('cartItems')
					.withIndex('by_userId_and_productId', (q) => q.eq('userId', user._id))
					.take(MAX_CART_LINES)
			).length;
			if (count >= MAX_CART_LINES) throw new ConvexError({ code: 'CART_FULL' });
			await ctx.db.insert('cartItems', {
				userId: user._id,
				productId: args.productId,
				quantity: allowed
			});
		}
		return { quantity: allowed, status: allowed < args.quantity ? ('clamped' as const) : ('ok' as const) };
	}
});

/**
 * Folds a guest cart (from localStorage) into the signed-in cart after sign-in. For a product in
 * both, the larger quantity wins instead of the sum, so a repeated call with the same lines (a
 * retry after a lost response, a second tab) can never double anything. Each result is clamped to
 * what is available. Ids come from the browser, so malformed, unknown and hidden ones are skipped.
 */
export const mergeGuestCart = mutation({
	args: { lines: v.array(v.object({ productId: v.string(), quantity: v.number() })) },
	returns: v.object({ merged: v.number() }),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		if (args.lines.length > MAX_MERGE_LINES) {
			throw new ConvexError({ code: 'TOO_MANY_LINES', max: MAX_MERGE_LINES });
		}

		let merged = 0;
		const seen = new Set<string>();
		for (const line of args.lines) {
			const productId = ctx.db.normalizeId('products', line.productId);
			if (!productId) continue;
			if (!isWholeNumber(line.quantity) || line.quantity === 0) continue;
			// After validation, so an invalid line can't shadow a valid one for the same product
			if (seen.has(productId)) continue;
			seen.add(productId);

			const product = await ctx.db.get(productId);
			if (!product || !product.isActive) continue;
			const limit = maxQuantityFor(product);
			if (limit === 0) continue;

			const existing = await findLine(ctx, user._id, productId);
			const quantity = Math.min(Math.max(existing?.quantity ?? 0, line.quantity), limit);
			if (existing) {
				if (existing.quantity === quantity) continue;
				await ctx.db.patch(existing._id, { quantity });
			} else {
				await ctx.db.insert('cartItems', { userId: user._id, productId, quantity });
			}
			merged++;
		}
		return { merged };
	}
});
