/**
 * Products CSV: export, preview an import, apply it. Every function calls `requireAppAdmin`.
 * The browser parses the file and sends its rows; the server plans them with `planImport` both
 * for the preview and again inside `applyImport`, which is one transaction, so a failure anywhere
 * leaves nothing half-imported. Stock only changes through `adjustStock`.
 */
import { ConvexError, v } from 'convex/values';
import type { Id } from '../../_generated/dataModel';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import { MAX_CATEGORIES } from '../../model/store/product';
import {
	IMPORT_COLUMNS,
	MAX_IMPORT_ROWS,
	loadPlan,
	type ImportRow,
	type PlannedRow
} from '../../model/store/productImport';
import { adjustStock } from '../../model/store/stock';
import { allCategories, insertCategory, nextSortOrder } from './categories';

const importRows = v.array(v.record(v.string(), v.string()));
const stockMode = v.union(v.literal('keep'), v.literal('add'), v.literal('set'));
const seenStock = v.array(v.object({ slug: v.string(), stock: v.number() }));

const toRows = (rows: Record<string, string>[]): ImportRow[] => rows;

const problem = v.object({
	field: v.string(),
	reason: v.union(
		v.literal('missing'),
		v.literal('invalid'),
		v.literal('duplicate'),
		v.literal('below_held'),
		v.literal('too_many_categories')
	)
});

/**
 * What an import would do, row by row, without changing anything. In `set` mode it also returns
 * the stock it saw for each matched product (`seen`); `applyImport` refuses if any has moved.
 */
export const previewImport = query({
	args: { rows: importRows, mode: stockMode },
	returns: v.object({
		rows: v.array(
			v.object({
				row: v.number(),
				kind: v.union(v.literal('new'), v.literal('update'), v.literal('error')),
				name: v.string(),
				problem: v.optional(problem),
				stockFrom: v.optional(v.number()),
				stockTo: v.optional(v.number())
			})
		),
		newCategories: v.array(v.string()),
		seen: seenStock
	}),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const plan = await loadPlan(ctx, toRows(args.rows), args.mode);
		return {
			rows: plan.rows.map((planned) => ({
				row: planned.row,
				kind: planned.kind,
				name: planned.name,
				...(planned.kind === 'error' ? { problem: planned.problem } : {}),
				...(planned.kind === 'update' ? { stockFrom: planned.stockFrom, stockTo: planned.stockTo } : {}),
				...(planned.kind === 'new' ? { stockTo: planned.stock } : {})
			})),
			newCategories: plan.newCategories,
			seen:
				args.mode === 'set'
					? [...plan.matchedStock].map(([slug, stock]) => ({ slug, stock }))
					: []
		};
	}
});

/**
 * Applies an import, all or nothing. Throws `ConvexError({ code })`: `IMPORT_HAS_ERRORS` if any
 * row is wrong, or `STOCK_CHANGED` (in `set` mode) if the stock of any product has moved since the
 * preview, because the counted numbers were worked out against the old stock.
 */
export const applyImport = mutation({
	args: { rows: importRows, mode: stockMode, seen: seenStock },
	returns: v.object({ created: v.number(), updated: v.number(), categoriesCreated: v.number() }),
	handler: async (ctx, args) => {
		const admin = await requireAppAdmin(ctx);
		const plan = await loadPlan(ctx, toRows(args.rows), args.mode);

		if (plan.rows.some((planned) => planned.kind === 'error')) {
			throw new ConvexError({ code: 'IMPORT_HAS_ERRORS' });
		}
		if (args.mode === 'set') {
			const before = new Map(args.seen.map((entry) => [entry.slug, entry.stock]));
			const moved = [...plan.matchedStock].filter(([slug, stock]) => before.get(slug) !== stock);
			if (moved.length > 0) {
				throw new ConvexError({ code: 'STOCK_CHANGED', slugs: moved.map(([slug]) => slug).slice(0, 20) });
			}
		}

		const existing = await allCategories(ctx);
		if (existing.length + plan.newCategories.length > MAX_CATEGORIES) {
			throw new ConvexError({ code: 'TOO_MANY_CATEGORIES' });
		}
		const createdIds = new Map<string, Id<'categories'>>();
		let sortOrder = nextSortOrder(existing);
		for (const name of plan.newCategories) {
			createdIds.set(name, await insertCategory(ctx, name, sortOrder++));
		}
		const categoryIdOf = (planned: Extract<PlannedRow, { kind: 'new' | 'update' }>) =>
			'id' in planned.category ? planned.category.id : createdIds.get(planned.category.name)!;

		let created = 0;
		let updated = 0;
		for (const planned of plan.rows) {
			if (planned.kind === 'new') {
				const productId = await ctx.db.insert('products', {
					...planned.fields,
					categoryId: categoryIdOf(planned),
					slug: planned.slug,
					stock: 0
				});
				if (planned.stock > 0) {
					await adjustStock(ctx, {
						productId,
						delta: planned.stock,
						reason: 'received',
						actorId: admin._id
					});
				}
				created++;
			} else if (planned.kind === 'update') {
				// `undefined` removes an optional field in a patch; the plan already merged in the old value
				await ctx.db.patch(planned.productId, { ...planned.fields, categoryId: categoryIdOf(planned) });
				if (planned.stockTo !== planned.stockFrom) {
					await adjustStock(ctx, {
						productId: planned.productId,
						delta: planned.stockTo - planned.stockFrom,
						reason: args.mode === 'add' ? 'received' : 'correction',
						actorId: admin._id
					});
				}
				updated++;
			}
		}
		return { created, updated, categoriesCreated: createdIds.size };
	}
});

const yesNo = (value: boolean) => (value ? 'yes' : 'no');

/**
 * Every product as CSV rows, hidden ones too, in the import's column order, so a file can be
 * exported, edited and imported back. At most MAX_IMPORT_ROWS; `truncated` says there were more.
 */
export const exportProducts = query({
	args: {},
	returns: v.object({
		columns: v.array(v.string()),
		rows: v.array(v.record(v.string(), v.string())),
		truncated: v.boolean()
	}),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const categories = new Map((await allCategories(ctx)).map((c) => [c._id, c.name]));
		const products = await ctx.db.query('products').take(MAX_IMPORT_ROWS + 1);
		return {
			columns: [...IMPORT_COLUMNS],
			truncated: products.length > MAX_IMPORT_ROWS,
			rows: products.slice(0, MAX_IMPORT_ROWS).map((product) => ({
				slug: product.slug,
				name: product.name,
				category: categories.get(product.categoryId) ?? '',
				unit: product.unitLabel,
				price: (product.pricePaise / 100).toFixed(2),
				mrp: (product.mrpPaise / 100).toFixed(2),
				stock: String(product.stock),
				low_stock_at: product.lowStockAt === undefined ? '' : String(product.lowStockAt),
				max_per_order: String(product.maxPerOrder),
				featured: yesNo(product.isFeatured),
				active: yesNo(product.isActive),
				gst_rate: product.gstRatePercent === undefined ? '' : String(product.gstRatePercent),
				hsn: product.hsn ?? ''
			}))
		};
	}
});
