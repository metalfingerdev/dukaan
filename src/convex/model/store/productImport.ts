/**
 * Turning the rows of a products CSV into a plan: which rows create a product, which change one,
 * which are wrong. `planImport` is pure (no database), so the preview and the apply step run the
 * exact same logic, and `applyImport` re-plans on the server instead of trusting the browser.
 *
 * Rules, each one so a re-import of a spreadsheet can't do surprising damage:
 * - A row matches a product by its `slug` cell, or else by the slug built from name and pack size.
 * - A blank cell leaves the field as it is (a new product gets a default instead).
 * - An unknown category is created, once, however many rows use it.
 * - Stock follows the chosen mode, and only for rows that have a stock cell:
 *   `keep` never touches an existing product's stock, `add` adds the cell as goods received, `set`
 *   treats the cell as a shelf count (count minus what open orders hold, as on the stock screen).
 *   A new product always starts with the stock cell as its opening stock.
 */
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import {
	MAX_CATEGORIES,
	PRODUCT_LIMITS,
	cleanCategoryName,
	isValidOpeningStock,
	slugify,
	validateProduct
} from './product';
import { parseRupees } from './rupees';
import { heldByProduct } from './stock';

export const IMPORT_COLUMNS = [
	'slug',
	'name',
	'category',
	'unit',
	'price',
	'mrp',
	'stock',
	'low_stock_at',
	'max_per_order',
	'featured',
	'active',
	'gst_rate',
	'hsn'
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/** One CSV row: the text of each cell by column name (missing or blank means "no value") */
export type ImportRow = Partial<Record<ImportColumn, string>>;

export const MAX_IMPORT_ROWS = 1000;
const DEFAULT_MAX_PER_ORDER = 10;

export type StockMode = 'keep' | 'add' | 'set';

export type ExistingProduct = Pick<
	Doc<'products'>,
	| '_id'
	| 'slug'
	| 'categoryId'
	| 'name'
	| 'unitLabel'
	| 'pricePaise'
	| 'mrpPaise'
	| 'stock'
	| 'lowStockAt'
	| 'maxPerOrder'
	| 'isActive'
	| 'isFeatured'
	| 'gstRatePercent'
	| 'hsn'
>;

export type ExistingCategory = Pick<Doc<'categories'>, '_id' | 'name' | 'slug'>;

export type Problem = {
	field: string;
	reason: 'missing' | 'invalid' | 'duplicate' | 'below_held' | 'too_many_categories';
};

export type CategoryRef = { id: Id<'categories'> } | { name: string };
type Fields = ReturnType<typeof validateProduct>;

export type PlannedRow =
	| { row: number; kind: 'error'; name: string; problem: Problem }
	| {
			row: number;
			kind: 'new';
			name: string;
			slug: string;
			category: CategoryRef;
			fields: Fields;
			stock: number;
	  }
	| {
			row: number;
			kind: 'update';
			name: string;
			slug: string;
			productId: Id<'products'>;
			category: CategoryRef;
			fields: Fields;
			stockFrom: number;
			stockTo: number;
	  };

export type Plan = {
	rows: PlannedRow[];
	/** Categories to create, in the order first used */
	newCategories: string[];
};

const cell = (row: ImportRow, column: ImportColumn) => (row[column] ?? '').trim();

/** The link a row refers to: its slug cell, or the one built from name and pack size; `''` if neither */
export function rowSlug(row: ImportRow): string {
	const given = cell(row, 'slug');
	if (given) return slugify(given);
	return slugify(cell(row, 'name'), cell(row, 'unit'));
}

const BOOLEANS: Record<string, boolean> = {
	yes: true,
	y: true,
	true: true,
	'1': true,
	no: false,
	n: false,
	false: false,
	'0': false
};

class RowProblem extends Error {
	constructor(readonly problem: Problem) {
		super(problem.field);
	}
}
function fail(field: string, reason: Problem['reason'] = 'invalid'): never {
	throw new RowProblem({ field, reason });
}

// validateProduct names fields as the form does; the CSV calls some of them something else
const COLUMN_OF_FIELD: Record<string, string> = {
	unitLabel: 'unit',
	pricePaise: 'price',
	mrpPaise: 'mrp',
	maxPerOrder: 'max_per_order',
	lowStockAt: 'low_stock_at',
	gstRatePercent: 'gst_rate',
	isActive: 'active',
	isFeatured: 'featured'
};

const wholeNumber = (text: string, field: string) =>
	/^\d+$/.test(text) ? Number(text) : fail(field);

export function planImport(args: {
	rows: ImportRow[];
	mode: StockMode;
	/** The existing products the rows may match, by slug */
	products: Map<string, ExistingProduct>;
	categories: ExistingCategory[];
	/** Units held by placed and accepted orders, by product; only read in `set` mode */
	held: Map<Id<'products'>, number>;
}): Plan {
	const { mode, products, categories, held } = args;
	const newCategories: string[] = [];
	const seenSlugs = new Set<string>();

	const findCategory = (name: string): CategoryRef => {
		const wanted = name.toLowerCase();
		const known = categories.find(
			(category) => category.name.toLowerCase() === wanted || category.slug === wanted
		);
		if (known) return { id: known._id };
		const clean = cleanCategoryName(name);
		if (!clean) return fail('category');
		const already = newCategories.find((created) => created.toLowerCase() === clean.toLowerCase());
		if (already) return { name: already };
		if (categories.length + newCategories.length >= MAX_CATEGORIES) {
			return fail('category', 'too_many_categories');
		}
		newCategories.push(clean);
		return { name: clean };
	};

	const planRow = (row: ImportRow, index: number): PlannedRow => {
		const number = index + 1;
		const nameCell = cell(row, 'name').replace(/\s+/g, ' ');
		const label = nameCell || cell(row, 'slug');
		// Categories are claimed as rows are planned; undo the claim if the row then fails
		const claimed = newCategories.length;
		try {
			const slug = rowSlug(row);
			if (!slug) return fail(cell(row, 'slug') ? 'slug' : nameCell ? 'unit' : 'name', 'missing');
			if (seenSlugs.has(slug)) return fail('slug', 'duplicate');
			seenSlugs.add(slug);

			const existing = products.get(slug);
			const text = (column: ImportColumn) => cell(row, column);

			const price = text('price') ? (parseRupees(text('price')) ?? fail('price')) : undefined;
			const mrp = text('mrp') ? (parseRupees(text('mrp')) ?? fail('mrp')) : undefined;
			const maxPerOrder = text('max_per_order')
				? wholeNumber(text('max_per_order'), 'max_per_order')
				: undefined;
			const lowStockAt = text('low_stock_at')
				? wholeNumber(text('low_stock_at'), 'low_stock_at')
				: undefined;
			const gst = text('gst_rate')
				? Number.isFinite(Number(text('gst_rate')))
					? Number(text('gst_rate'))
					: fail('gst_rate')
				: undefined;
			const flag = (column: 'featured' | 'active') =>
				text(column) ? (BOOLEANS[text(column).toLowerCase()] ?? fail(column)) : undefined;
			const featured = flag('featured');
			const active = flag('active');
			const stockCell = text('stock') ? wholeNumber(text('stock'), 'stock') : undefined;

			// What a blank cell means: keep the product's value, or for a new product a default
			if (!existing) {
				if (!nameCell) fail('name', 'missing');
				if (!text('unit')) fail('unit', 'missing');
				if (!text('category')) fail('category', 'missing');
				if (price === undefined) fail('price', 'missing');
			}
			const category = text('category')
				? findCategory(text('category'))
				: { id: existing!.categoryId };

			const fields = validateProduct({
				name: nameCell || existing!.name,
				unitLabel: text('unit') || existing?.unitLabel || '',
				pricePaise: price ?? existing!.pricePaise,
				// A new product's MRP defaults to its price; an existing one keeps its MRP, so raising the
				// price above it is refused instead of silently moving the MRP
				mrpPaise: mrp ?? existing?.mrpPaise ?? price ?? 0,
				maxPerOrder: maxPerOrder ?? existing?.maxPerOrder ?? DEFAULT_MAX_PER_ORDER,
				lowStockAt: lowStockAt ?? existing?.lowStockAt,
				isActive: active ?? existing?.isActive ?? true,
				isFeatured: featured ?? existing?.isFeatured ?? false,
				gstRatePercent: gst ?? existing?.gstRatePercent,
				hsn: text('hsn') || existing?.hsn
			});

			if (!existing) {
				const stock = stockCell ?? 0;
				if (!isValidOpeningStock(stock)) fail('stock');
				return { row: number, kind: 'new', name: fields.name, slug, category, fields, stock };
			}

			let stockTo = existing.stock;
			if (stockCell !== undefined && mode === 'add') stockTo = existing.stock + stockCell;
			if (stockCell !== undefined && mode === 'set') {
				stockTo = stockCell - (held.get(existing._id) ?? 0);
				if (stockTo < 0) fail('stock', 'below_held');
			}
			if (stockTo > PRODUCT_LIMITS.maxOpeningStock) fail('stock');
			return {
				row: number,
				kind: 'update',
				name: fields.name,
				slug,
				productId: existing._id,
				category,
				fields,
				stockFrom: existing.stock,
				stockTo
			};
		} catch (error) {
			newCategories.length = claimed;
			if (error instanceof RowProblem) {
				return { row: number, kind: 'error', name: label, problem: error.problem };
			}
			// validateProduct names the bad field in a ConvexError
			if (error instanceof ConvexError) {
				const data = error.data as { field?: string };
				return {
					row: number,
					kind: 'error',
					name: label,
					problem: { field: COLUMN_OF_FIELD[data.field ?? ''] ?? data.field ?? 'name', reason: 'invalid' }
				};
			}
			throw error;
		}
	};

	return { rows: args.rows.map(planRow), newCategories };
}

/** Reads what `planImport` needs from the database and plans the rows */
export async function loadPlan(ctx: QueryCtx | MutationCtx, rows: ImportRow[], mode: StockMode) {
	if (rows.length > MAX_IMPORT_ROWS) throw new ConvexError({ code: 'TOO_MANY_ROWS', max: MAX_IMPORT_ROWS });

	const products = new Map<string, ExistingProduct>();
	for (const slug of new Set(rows.map(rowSlug).filter(Boolean))) {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		if (product) products.set(slug, product);
	}

	const [shown, hidden] = await Promise.all(
		[true, false].map((isActive) =>
			ctx.db
				.query('categories')
				.withIndex('by_isActive_and_sortOrder', (q) => q.eq('isActive', isActive))
				.take(MAX_CATEGORIES + 1)
		)
	);
	const categories = [...shown, ...hidden];

	const held = mode === 'set' ? await heldByProduct(ctx) : new Map<Id<'products'>, number>();
	const plan = planImport({ rows, mode, products, categories, held });
	const matchedStock = new Map([...products].map(([slug, product]) => [slug, product.stock]));
	return { ...plan, categories, matchedStock };
}
