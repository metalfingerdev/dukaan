/**
 * The categories the admin manages in /admin/categories: add, rename, hide and reorder. Every
 * function calls `requireAppAdmin`. A category is hidden, never deleted, because products, cart
 * lines and old orders point at it; hiding one hides all its products from customers.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import {
	MAX_CATEGORIES,
	cleanCategoryName,
	slugify,
	uniqueSlug
} from '../../model/store/product';

const adminCategory = v.object({
	_id: v.id('categories'),
	name: v.string(),
	slug: v.string(),
	isActive: v.boolean(),
	sortOrder: v.number()
});

const toAdminCategory = (category: Doc<'categories'>) => ({
	_id: category._id,
	name: category.name,
	slug: category.slug,
	isActive: category.isActive,
	sortOrder: category.sortOrder
});

/** Every category, hidden ones too, in display order. Bounded by MAX_CATEGORIES. */
const allCategories = async (ctx: QueryCtx | MutationCtx) => {
	const [shown, hidden] = await Promise.all(
		[true, false].map((isActive) =>
			ctx.db
				.query('categories')
				.withIndex('by_isActive_and_sortOrder', (q) => q.eq('isActive', isActive))
				.take(MAX_CATEGORIES + 1)
		)
	);
	return [...shown, ...hidden].sort((a, b) => a.sortOrder - b.sortOrder || a._creationTime - b._creationTime);
};

export const listCategories = query({
	args: {},
	returns: v.array(adminCategory),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		return (await allCategories(ctx)).map(toAdminCategory);
	}
});

/** Adds a category at the end, or throws `INVALID_CATEGORY` / `TOO_MANY_CATEGORIES` */
export const createCategory = mutation({
	args: { name: v.string() },
	returns: v.id('categories'),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const name = cleanCategoryName(args.name);
		if (!name) throw new ConvexError({ code: 'INVALID_CATEGORY', field: 'name' });
		const existing = await allCategories(ctx);
		if (existing.length >= MAX_CATEGORIES) throw new ConvexError({ code: 'TOO_MANY_CATEGORIES' });

		const slug = await uniqueSlug(slugify(name) || 'category', async (candidate) => {
			const taken = await ctx.db
				.query('categories')
				.withIndex('by_slug', (q) => q.eq('slug', candidate))
				.first();
			return taken !== null;
		});
		const sortOrder = existing.reduce((highest, category) => Math.max(highest, category.sortOrder), -1) + 1;
		return await ctx.db.insert('categories', { name, slug, sortOrder, isActive: true });
	}
});

/** Renames a category (its link stays the same) and/or hides or shows it */
export const updateCategory = mutation({
	args: { categoryId: v.id('categories'), name: v.string(), isActive: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const name = cleanCategoryName(args.name);
		if (!name) throw new ConvexError({ code: 'INVALID_CATEGORY', field: 'name' });
		const category = await ctx.db.get(args.categoryId);
		if (!category) throw new ConvexError({ code: 'CATEGORY_NOT_FOUND' });
		await ctx.db.patch(category._id, { name, isActive: args.isActive });
		return null;
	}
});

/**
 * Moves a category one place up or down among all of them. Rewrites every sort position from the
 * current order, so it also repairs ties.
 */
export const moveCategory = mutation({
	args: { categoryId: v.id('categories'), direction: v.union(v.literal('up'), v.literal('down')) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const ordered = await allCategories(ctx);
		const from = ordered.findIndex((category) => category._id === args.categoryId);
		if (from === -1) throw new ConvexError({ code: 'CATEGORY_NOT_FOUND' });
		const to = args.direction === 'up' ? from - 1 : from + 1;
		if (to >= 0 && to < ordered.length) {
			[ordered[from], ordered[to]] = [ordered[to], ordered[from]];
		}
		for (const [sortOrder, category] of ordered.entries()) {
			if (category.sortOrder !== sortOrder) await ctx.db.patch(category._id, { sortOrder });
		}
		return null;
	}
});
