/**
 * Demo data for development. Internal, so only the CLI, the dashboard or other Convex functions
 * can run it; the storefront can't. Run it on the dev deployment:
 *
 *   npx convex run store/seed:seedDemo
 *   npx convex run store/seed:removeDemo
 *
 * `seedDemo` is safe to repeat: it only adds what is missing (matched by slug) and never touches
 * the existing `storeSettings` row. It writes made-up products, so don't run it on a deployment
 * that serves real customers unless you mean to.
 */
import { ConvexError, v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { internalMutation } from '../_generated/server';
import { validateDeliveryAreas } from '../model/store/address';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../model/store/demoCatalog';
import { STORE_SETTINGS_DEFAULTS } from '../model/store/storeProfile';

const findCategory = (ctx: MutationCtx, slug: string) =>
	ctx.db
		.query('categories')
		.withIndex('by_slug', (q) => q.eq('slug', slug))
		.unique();

const findProduct = (ctx: MutationCtx, slug: string) =>
	ctx.db
		.query('products')
		.withIndex('by_slug', (q) => q.eq('slug', slug))
		.unique();

export const seedDemo = internalMutation({
	args: {},
	returns: v.object({
		settingsAdded: v.boolean(),
		categoriesAdded: v.number(),
		productsAdded: v.number()
	}),
	handler: async (ctx) => {
		const settings = await ctx.db.query('storeSettings').first();
		if (!settings) await ctx.db.insert('storeSettings', STORE_SETTINGS_DEFAULTS);

		let categoriesAdded = 0;
		for (const [sortOrder, category] of DEMO_CATEGORIES.entries()) {
			if (await findCategory(ctx, category.slug)) continue;
			await ctx.db.insert('categories', { ...category, sortOrder, isActive: true });
			categoriesAdded++;
		}

		let productsAdded = 0;
		for (const product of DEMO_PRODUCTS) {
			const category = await findCategory(ctx, product.categorySlug);
			if (!category) throw new ConvexError(`Demo category ${product.categorySlug} is missing`);
			if (await findProduct(ctx, product.slug)) continue;
			await ctx.db.insert('products', {
				categoryId: category._id,
				name: product.name,
				slug: product.slug,
				unitLabel: product.unitLabel,
				pricePaise: product.pricePaise,
				mrpPaise: product.mrpPaise,
				stock: product.stock,
				lowStockAt: product.lowStockAt,
				maxPerOrder: product.maxPerOrder,
				isActive: true,
				isFeatured: product.isFeatured ?? false
			});
			productsAdded++;
		}

		return { settingsAdded: !settings, categoriesAdded, productsAdded };
	}
});

/**
 * Sets the areas customers can deliver to, until `/admin/settings` exists:
 *
 *   npx convex run store/seed:setDeliveryAreas '{"areas":["Main Market","Govt College","Boys Hostel"]}'
 *
 * Add `--prod` for staging. Saved addresses keep the area they were saved with, but checkout
 * refuses an address whose area is no longer in this list, so rename areas with care.
 */
export const setDeliveryAreas = internalMutation({
	args: { areas: v.array(v.string()) },
	returns: v.object({ areas: v.array(v.string()) }),
	handler: async (ctx, args) => {
		const areas = validateDeliveryAreas(args.areas);
		const settings = await ctx.db.query('storeSettings').first();
		if (!settings) throw new ConvexError('Run seedDemo first: there is no storeSettings row');
		await ctx.db.patch(settings._id, { deliveryAreas: areas });
		return { areas };
	}
});

/**
 * Deletes the demo products and categories (matched by slug) and leaves `storeSettings` alone.
 * Refuses once any order exists, since deleting a product an order points to would leave it
 * dangling. Signed-in cart lines for the removed products go too. Development only.
 */
export const removeDemo = internalMutation({
	args: {},
	returns: v.object({ categoriesRemoved: v.number(), productsRemoved: v.number() }),
	handler: async (ctx) => {
		if (await ctx.db.query('orders').first()) {
			throw new ConvexError('Orders exist; the demo catalogue can no longer be removed safely');
		}

		const demoProductIds = new Set<Id<'products'>>();
		for (const product of DEMO_PRODUCTS) {
			const existing = await findProduct(ctx, product.slug);
			if (existing) demoProductIds.add(existing._id);
		}

		// The cart index starts with userId, so scan the (dev-sized) table once rather than per product
		for (const line of await ctx.db.query('cartItems').take(1000)) {
			if (demoProductIds.has(line.productId)) await ctx.db.delete(line._id);
		}
		for (const id of demoProductIds) await ctx.db.delete(id);

		let categoriesRemoved = 0;
		for (const category of DEMO_CATEGORIES) {
			const existing = await findCategory(ctx, category.slug);
			if (!existing) continue;
			await ctx.db.delete(existing._id);
			categoriesRemoved++;
		}
		return { categoriesRemoved, productsRemoved: demoProductIds.size };
	}
});
