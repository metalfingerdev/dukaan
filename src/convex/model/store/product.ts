/**
 * Validation and slugs for the products and categories the admin edits. Pure, so it is tested
 * without a database. `validateProduct` throws `ConvexError({ code: 'INVALID_PRODUCT', field })`
 * naming the first bad field, so the form can show the message next to it. Money is integer paise.
 *
 * The GST rate and HSN are stored as the admin types them. Which items are taxed and at what rate
 * is the store's accountant's call, so nothing here asserts a tax rule.
 */
import { ConvexError } from 'convex/values';

export const PRODUCT_LIMITS = {
	maxNameLength: 80,
	maxUnitLabelLength: 30,
	maxPricePaise: 100_000 * 100,
	maxPerOrder: 100,
	maxLowStockAt: 100,
	maxOpeningStock: 100_000,
	maxGstRatePercent: 28
} as const;

export const MAX_CATEGORIES = 50;
export const MAX_CATEGORY_NAME_LENGTH = 40;

export type ProductInput = {
	name: string;
	unitLabel: string;
	pricePaise: number;
	mrpPaise: number;
	maxPerOrder: number;
	/** Missing means no "only few left" warning */
	lowStockAt?: number;
	isActive: boolean;
	isFeatured: boolean;
	/** Missing removes it */
	gstRatePercent?: number;
	/** Missing or blank removes it */
	hsn?: string;
};

export type ProductField = keyof ProductInput | 'categoryId' | 'stock';

const invalid = (field: ProductField) => new ConvexError({ code: 'INVALID_PRODUCT', field });

const isPaise = (value: number) =>
	Number.isSafeInteger(value) && value >= 1 && value <= PRODUCT_LIMITS.maxPricePaise;

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');

/** The cleaned fields to store, or throws naming the bad field */
export function validateProduct(input: ProductInput) {
	const name = tidy(input.name);
	if (name.length === 0 || name.length > PRODUCT_LIMITS.maxNameLength) throw invalid('name');
	const unitLabel = tidy(input.unitLabel);
	if (unitLabel.length === 0 || unitLabel.length > PRODUCT_LIMITS.maxUnitLabelLength) {
		throw invalid('unitLabel');
	}

	if (!isPaise(input.pricePaise)) throw invalid('pricePaise');
	if (!isPaise(input.mrpPaise) || input.mrpPaise < input.pricePaise) throw invalid('mrpPaise');

	if (
		!Number.isInteger(input.maxPerOrder) ||
		input.maxPerOrder < 1 ||
		input.maxPerOrder > PRODUCT_LIMITS.maxPerOrder
	) {
		throw invalid('maxPerOrder');
	}
	if (
		input.lowStockAt !== undefined &&
		(!Number.isInteger(input.lowStockAt) ||
			input.lowStockAt < 0 ||
			input.lowStockAt > PRODUCT_LIMITS.maxLowStockAt)
	) {
		throw invalid('lowStockAt');
	}

	if (
		input.gstRatePercent !== undefined &&
		(!Number.isFinite(input.gstRatePercent) ||
			input.gstRatePercent < 0 ||
			input.gstRatePercent > PRODUCT_LIMITS.maxGstRatePercent ||
			// at most two decimals, so 2.5 and 0.25 pass but 2.333 doesn't
			Math.round(input.gstRatePercent * 100) / 100 !== input.gstRatePercent)
	) {
		throw invalid('gstRatePercent');
	}

	const hsn = input.hsn?.trim() || undefined;
	if (hsn !== undefined && !/^\d{2,8}$/.test(hsn)) throw invalid('hsn');

	return {
		name,
		unitLabel,
		pricePaise: input.pricePaise,
		mrpPaise: input.mrpPaise,
		maxPerOrder: input.maxPerOrder,
		lowStockAt: input.lowStockAt,
		isActive: input.isActive,
		isFeatured: input.isFeatured,
		gstRatePercent: input.gstRatePercent,
		hsn
	};
}

/** Opening stock when a product is created: a whole number from 0 up */
export const isValidOpeningStock = (stock: number) =>
	Number.isSafeInteger(stock) && stock >= 0 && stock <= PRODUCT_LIMITS.maxOpeningStock;

/** "Amul Paneer", "200 g" becomes "amul-paneer-200-g"; text with no letters or digits becomes "" */
export function slugify(...parts: string[]): string {
	return parts
		.join(' ')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
}

const MAX_SLUG_ATTEMPTS = 50;

/**
 * The first of `base`, `base-2`, `base-3`... for which `exists` is false. A slug is fixed when the
 * row is created, so renaming a product never breaks a link a customer saved.
 */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
	for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
		const slug = attempt === 1 ? base : `${base}-${attempt}`;
		if (!(await exists(slug))) return slug;
	}
	throw new ConvexError({ code: 'SLUG_TAKEN' });
}

/** The cleaned category name, or `null` when it is empty or too long */
export function cleanCategoryName(name: string): string | null {
	const clean = tidy(name);
	return clean.length > 0 && clean.length <= MAX_CATEGORY_NAME_LENGTH ? clean : null;
}
