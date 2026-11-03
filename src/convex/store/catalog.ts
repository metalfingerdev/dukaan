/**
 * Public catalogue reads. These are deliberately public (no access guard): a visitor can browse
 * and fill a cart before signing in. So every function returns a purpose-built projection, never
 * a raw document. A projection can't leak a field that is added to a table later: no exact stock
 * (only `inStock`, `lowStock` and the most a customer may add), no GST fields, no inactive rows.
 * See .agents/skills/store-app/references/customer.md.
 */
import { ConvexError, v } from 'convex/values';
import { query } from '../_generated/server';
import {
	publicCategory,
	publicProduct,
	toPublicCategory,
	toPublicProduct
} from '../model/store/publicProjection';

const MAX_CATEGORIES = 50;
const MAX_FEATURED = 20;
const MAX_CATEGORY_PRODUCTS = 100;
const MAX_RELATED = 8;
const MAX_SEARCH_RESULTS = 24;
const MAX_IDS = 50;
const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 64;

/** What the header and cart need: open switch, hours, ETA and the fees. No UPI id or legal details. */
export const getStoreInfo = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			storeName: v.string(),
			isOpen: v.boolean(),
			opensAtMinute: v.number(),
			closesAtMinute: v.number(),
			etaMinutes: v.number(),
			minOrderPaise: v.number(),
			deliveryAreas: v.array(v.string()),
			deliveryFeePaise: v.number(),
			freeDeliveryAbovePaise: v.number(),
			smallCartFeePaise: v.number(),
			smallCartBelowPaise: v.number(),
			storePhone: v.optional(v.string())
		})
	),
	handler: async (ctx) => {
		const settings = await ctx.db.query('storeSettings').first();
		if (!settings) return null;
		return {
			storeName: settings.storeName,
			isOpen: settings.isOpen,
			opensAtMinute: settings.opensAtMinute,
			closesAtMinute: settings.closesAtMinute,
			etaMinutes: settings.etaMinutes,
			minOrderPaise: settings.minOrderPaise,
			deliveryAreas: settings.deliveryAreas,
			deliveryFeePaise: settings.deliveryFeePaise,
			freeDeliveryAbovePaise: settings.freeDeliveryAbovePaise,
			smallCartFeePaise: settings.smallCartFeePaise,
			smallCartBelowPaise: settings.smallCartBelowPaise,
			...(settings.storePhone !== undefined ? { storePhone: settings.storePhone } : {})
		};
	}
});

export const listCategories = query({
	args: {},
	returns: v.array(publicCategory),
	handler: async (ctx) => {
		const categories = await ctx.db
			.query('categories')
			.withIndex('by_isActive_and_sortOrder', (q) => q.eq('isActive', true))
			.take(MAX_CATEGORIES);
		return await Promise.all(categories.map((category) => toPublicCategory(ctx, category)));
	}
});

export const listFeatured = query({
	args: {},
	returns: v.array(publicProduct),
	handler: async (ctx) => {
		const products = await ctx.db
			.query('products')
			.withIndex('by_isFeatured_and_isActive', (q) => q.eq('isFeatured', true).eq('isActive', true))
			.take(MAX_FEATURED);
		return await Promise.all(products.map((product) => toPublicProduct(ctx, product)));
	}
});

/** One category and its active products, or `null` when the slug is unknown or the category is hidden */
export const listProducts = query({
	args: { categorySlug: v.string() },
	returns: v.union(
		v.null(),
		v.object({ category: publicCategory, products: v.array(publicProduct) })
	),
	handler: async (ctx, args) => {
		const category = await ctx.db
			.query('categories')
			.withIndex('by_slug', (q) => q.eq('slug', args.categorySlug))
			.unique();
		if (!category || !category.isActive) return null;
		const products = await ctx.db
			.query('products')
			.withIndex('by_categoryId_and_isActive', (q) =>
				q.eq('categoryId', category._id).eq('isActive', true)
			)
			.take(MAX_CATEGORY_PRODUCTS);
		return {
			category: await toPublicCategory(ctx, category),
			products: await Promise.all(products.map((product) => toPublicProduct(ctx, product)))
		};
	}
});

/** One product, its category, and other products from the same category; `null` when hidden or unknown */
export const getProduct = query({
	args: { slug: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			product: publicProduct,
			category: v.object({ name: v.string(), slug: v.string() }),
			related: v.array(publicProduct)
		})
	),
	handler: async (ctx, args) => {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique();
		if (!product || !product.isActive) return null;
		const category = await ctx.db.get(product.categoryId);
		if (!category) return null;
		// One extra row, since the product itself may be among them
		const siblings = await ctx.db
			.query('products')
			.withIndex('by_categoryId_and_isActive', (q) =>
				q.eq('categoryId', product.categoryId).eq('isActive', true)
			)
			.take(MAX_RELATED + 1);
		const related = siblings.filter((sibling) => sibling._id !== product._id).slice(0, MAX_RELATED);
		return {
			product: await toPublicProduct(ctx, product),
			category: { name: category.name, slug: category.slug },
			related: await Promise.all(related.map((sibling) => toPublicProduct(ctx, sibling)))
		};
	}
});

/**
 * Current details for a guest's cart lines. Ids come from the browser's localStorage, so they are
 * taken as plain strings: a malformed, unknown or hidden id is skipped instead of failing the whole
 * cart. At most 50 ids.
 */
export const getProductsByIds = query({
	args: { ids: v.array(v.string()) },
	returns: v.array(publicProduct),
	handler: async (ctx, args) => {
		if (args.ids.length > MAX_IDS) throw new ConvexError(`At most ${MAX_IDS} products at a time`);
		const found = await Promise.all(
			args.ids.map(async (raw) => {
				const id = ctx.db.normalizeId('products', raw);
				const product = id ? await ctx.db.get(id) : null;
				return product && product.isActive ? await toPublicProduct(ctx, product) : null;
			})
		);
		return found.filter((product) => product !== null);
	}
});

export const searchProducts = query({
	args: { q: v.string() },
	returns: v.array(publicProduct),
	handler: async (ctx, args) => {
		const text = args.q.trim().slice(0, MAX_SEARCH_LENGTH);
		if (text.length < MIN_SEARCH_LENGTH) return [];
		const products = await ctx.db
			.query('products')
			.withSearchIndex('search_name', (q) => q.search('name', text).eq('isActive', true))
			.take(MAX_SEARCH_RESULTS);
		return await Promise.all(products.map((product) => toPublicProduct(ctx, product)));
	}
});
