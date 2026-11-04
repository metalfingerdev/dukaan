/**
 * What a customer may see of a product or category. Shared by the catalogue and the cart so both
 * return the same shape, and so a new column on `products` can't reach the browser by accident.
 */
import { v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import type { QueryCtx } from '../../_generated/server';

export const publicProduct = v.object({
	_id: v.id('products'),
	name: v.string(),
	slug: v.string(),
	unitLabel: v.string(),
	pricePaise: v.number(),
	mrpPaise: v.number(),
	imageUrl: v.union(v.string(), v.null()),
	inStock: v.boolean(),
	lowStock: v.boolean(),
	// The most a customer can add: min(stock, maxPerOrder). Shows "Only 3 available" without
	// exposing stock beyond what the customer could buy anyway.
	maxQuantity: v.number(),
	// The real count, present only while `lowStock` is true ("Only 3 left"); never otherwise
	stockLeft: v.optional(v.number())
});

export const publicCategory = v.object({
	_id: v.id('categories'),
	name: v.string(),
	slug: v.string(),
	imageUrl: v.union(v.string(), v.null())
});

/** The most of a product one customer can hold in a cart or order right now */
export const maxQuantityFor = (product: Pick<Doc<'products'>, 'stock' | 'maxPerOrder'>) =>
	Math.max(0, Math.min(product.stock, product.maxPerOrder));

/**
 * Whether customers may see and buy a product: it is active and so is its category. Hiding a
 * category hides everything in it without touching each product, so showing the category again
 * brings back exactly what was on sale before.
 */
export const isProductVisible = async (ctx: Pick<QueryCtx, 'db'>, product: Doc<'products'>) => {
	if (!product.isActive) return false;
	const category = await ctx.db.get(product.categoryId);
	return category !== null && category.isActive;
};

/** The products customers may see, in the same order. Reads each category once. */
export const visibleProducts = async (ctx: Pick<QueryCtx, 'db'>, products: Doc<'products'>[]) => {
	const active = products.filter((product) => product.isActive);
	const categoryIds = [...new Set(active.map((product) => product.categoryId))];
	const categories = await Promise.all(categoryIds.map((id) => ctx.db.get(id)));
	const shown = new Set(categories.filter((c) => c?.isActive).map((c) => c!._id));
	return active.filter((product) => shown.has(product.categoryId));
};

export const toPublicProduct = async (ctx: QueryCtx, product: Doc<'products'>) => {
	const lowStock =
		product.stock > 0 && product.lowStockAt !== undefined && product.stock <= product.lowStockAt;
	return {
		_id: product._id,
		name: product.name,
		slug: product.slug,
		unitLabel: product.unitLabel,
		pricePaise: product.pricePaise,
		mrpPaise: product.mrpPaise,
		imageUrl: product.imageId ? await ctx.storage.getUrl(product.imageId) : null,
		inStock: product.stock > 0,
		lowStock,
		maxQuantity: maxQuantityFor(product),
		...(lowStock ? { stockLeft: product.stock } : {})
	};
};

export const toPublicCategory = async (ctx: QueryCtx, category: Doc<'categories'>) => ({
	_id: category._id,
	name: category.name,
	slug: category.slug,
	imageUrl: category.imageId ? await ctx.storage.getUrl(category.imageId) : null
});
