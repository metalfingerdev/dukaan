/**
 * The products the admin manages in /admin/products. Every function calls `requireAppAdmin`.
 * Products are hidden (`isActive: false`), never deleted, because carts and old orders point at
 * them. Stock is not editable here after creation: it only changes through `adjustStock`, which
 * the stock screen and orders use, so every change leaves a `stockAdjustments` row.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import type { QueryCtx } from '../../_generated/server';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import {
	isValidOpeningStock,
	slugify,
	uniqueSlug,
	validateProduct
} from '../../model/store/product';
import { adjustStock } from '../../model/store/stock';

const MAX_LIST = 200;
const MAX_SEARCH_LENGTH = 64;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** What the form edits; everything except stock and the image */
const productFields = {
	categoryId: v.id('categories'),
	name: v.string(),
	unitLabel: v.string(),
	pricePaise: v.number(),
	mrpPaise: v.number(),
	maxPerOrder: v.number(),
	lowStockAt: v.optional(v.number()),
	isActive: v.boolean(),
	isFeatured: v.boolean(),
	gstRatePercent: v.optional(v.number()),
	hsn: v.optional(v.string())
};

export const adminProduct = v.object({
	_id: v.id('products'),
	...productFields,
	slug: v.string(),
	stock: v.number(),
	imageUrl: v.union(v.string(), v.null())
});

export const toAdminProduct = async (ctx: QueryCtx, product: Doc<'products'>) => ({
	_id: product._id,
	categoryId: product.categoryId,
	name: product.name,
	slug: product.slug,
	unitLabel: product.unitLabel,
	pricePaise: product.pricePaise,
	mrpPaise: product.mrpPaise,
	stock: product.stock,
	maxPerOrder: product.maxPerOrder,
	isActive: product.isActive,
	isFeatured: product.isFeatured,
	imageUrl: product.imageId ? await ctx.storage.getUrl(product.imageId) : null,
	...(product.lowStockAt !== undefined ? { lowStockAt: product.lowStockAt } : {}),
	...(product.gstRatePercent !== undefined ? { gstRatePercent: product.gstRatePercent } : {}),
	...(product.hsn !== undefined ? { hsn: product.hsn } : {})
});

/**
 * Products for the admin list, hidden ones included. With `search`, the best matches by name
 * (optionally within one category); otherwise one category's products, or the newest products when
 * no category is given. At most 200.
 */
export const listProducts = query({
	args: { categoryId: v.optional(v.id('categories')), search: v.optional(v.string()) },
	returns: v.array(adminProduct),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const text = args.search?.trim().slice(0, MAX_SEARCH_LENGTH) ?? '';
		const { categoryId } = args;
		let products: Doc<'products'>[];
		if (text.length > 0) {
			products = await ctx.db
				.query('products')
				.withSearchIndex('search_name', (q) =>
					categoryId ? q.search('name', text).eq('categoryId', categoryId) : q.search('name', text)
				)
				.take(MAX_LIST);
		} else if (categoryId) {
			products = await ctx.db
				.query('products')
				.withIndex('by_categoryId_and_isActive', (q) => q.eq('categoryId', categoryId))
				.take(MAX_LIST);
		} else {
			products = await ctx.db.query('products').order('desc').take(MAX_LIST);
		}
		return await Promise.all(products.map((product) => toAdminProduct(ctx, product)));
	}
});

/** One product for the edit form. The id comes from the URL, so a malformed or unknown one is `null`. */
export const getProduct = query({
	args: { productId: v.string() },
	returns: v.union(v.null(), adminProduct),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const id = ctx.db.normalizeId('products', args.productId);
		const product = id ? await ctx.db.get(id) : null;
		return product ? await toAdminProduct(ctx, product) : null;
	}
});

/**
 * Adds a product, or throws `ConvexError({ code: 'INVALID_PRODUCT', field })`. Opening stock goes
 * in through `adjustStock` as "received", so the history starts with it.
 */
export const createProduct = mutation({
	args: { ...productFields, stock: v.number() },
	returns: v.id('products'),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		const { categoryId, stock, ...rest } = args;
		const clean = validateProduct(rest);
		if (!isValidOpeningStock(stock)) {
			throw new ConvexError({ code: 'INVALID_PRODUCT', field: 'stock' });
		}
		if (!(await ctx.db.get(categoryId))) {
			throw new ConvexError({ code: 'INVALID_PRODUCT', field: 'categoryId' });
		}

		const slug = await uniqueSlug(
			slugify(clean.name, clean.unitLabel) || 'product',
			async (candidate) => {
				const taken = await ctx.db
					.query('products')
					.withIndex('by_slug', (q) => q.eq('slug', candidate))
					.first();
				return taken !== null;
			}
		);
		const productId = await ctx.db.insert('products', { ...clean, categoryId, slug, stock: 0 });
		if (stock > 0) {
			await adjustStock(ctx, { productId, delta: stock, reason: 'received', actorId: admin._id });
		}
		return productId;
	}
});

/** Saves the form. Has no stock field on purpose, and the link (slug) never changes. */
export const updateProduct = mutation({
	args: { productId: v.id('products'), ...productFields },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const { productId, categoryId, ...rest } = args;
		const clean = validateProduct(rest);
		if (!(await ctx.db.get(productId))) throw new ConvexError({ code: 'PRODUCT_NOT_FOUND' });
		if (!(await ctx.db.get(categoryId))) {
			throw new ConvexError({ code: 'INVALID_PRODUCT', field: 'categoryId' });
		}
		// `undefined` removes an optional field in a patch, which is how a cleared box goes away
		await ctx.db.patch(productId, { ...clean, categoryId });
		return null;
	}
});

/**
 * A one-time URL to upload a product photo to. Admin only, unlike `storage.generateUploadUrl`,
 * which any signed-in user can call.
 */
export const generateImageUploadUrl = mutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		return await ctx.storage.generateUploadUrl();
	}
});

/**
 * Attaches an uploaded photo to a product (or removes it with `null`) and deletes the file it
 * replaces. Refuses anything that isn't a small image, since the upload URL accepts any file.
 */
export const setProductImage = mutation({
	args: { productId: v.id('products'), imageId: v.union(v.id('_storage'), v.null()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const product = await ctx.db.get(args.productId);
		if (!product) throw new ConvexError({ code: 'PRODUCT_NOT_FOUND' });

		if (args.imageId !== null) {
			const file = await ctx.db.system.get('_storage', args.imageId);
			if (!file || !file.contentType?.startsWith('image/') || file.size > MAX_IMAGE_BYTES) {
				if (file) await ctx.storage.delete(args.imageId);
				throw new ConvexError({ code: 'INVALID_IMAGE' });
			}
		}
		if (product.imageId && product.imageId !== args.imageId) {
			await ctx.storage.delete(product.imageId);
		}
		await ctx.db.patch(product._id, { imageId: args.imageId ?? undefined });
		return null;
	}
});
