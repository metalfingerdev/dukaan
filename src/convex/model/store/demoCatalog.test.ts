import { describe, expect, it } from 'vitest';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from './demoCatalog';

describe('demo catalogue', () => {
	it('has unique slugs', () => {
		const categories = DEMO_CATEGORIES.map((c) => c.slug);
		const products = DEMO_PRODUCTS.map((p) => p.slug);
		expect(new Set(categories).size).toBe(categories.length);
		expect(new Set(products).size).toBe(products.length);
	});

	it('puts every product in a known category, and every category has products', () => {
		const known = new Set(DEMO_CATEGORIES.map((c) => c.slug));
		for (const product of DEMO_PRODUCTS) expect(known).toContain(product.categorySlug);
		const used = new Set(DEMO_PRODUCTS.map((p) => p.categorySlug));
		for (const slug of known) expect(used).toContain(slug);
	});

	it('keeps money in whole paise with the MRP at or above the price', () => {
		for (const product of DEMO_PRODUCTS) {
			expect(Number.isInteger(product.pricePaise)).toBe(true);
			expect(Number.isInteger(product.mrpPaise)).toBe(true);
			expect(product.pricePaise).toBeGreaterThan(0);
			expect(product.mrpPaise).toBeGreaterThanOrEqual(product.pricePaise);
		}
	});

	it('has sensible stock and order limits', () => {
		for (const product of DEMO_PRODUCTS) {
			expect(Number.isInteger(product.stock)).toBe(true);
			expect(product.stock).toBeGreaterThanOrEqual(0);
			expect(product.maxPerOrder).toBeGreaterThanOrEqual(1);
		}
	});

	it('covers the states the storefront must show', () => {
		expect(DEMO_PRODUCTS.some((p) => p.stock === 0)).toBe(true);
		expect(
			DEMO_PRODUCTS.some((p) => p.lowStockAt !== undefined && p.stock > 0 && p.stock <= p.lowStockAt)
		).toBe(true);
		expect(DEMO_PRODUCTS.some((p) => p.isFeatured)).toBe(true);
		expect(DEMO_PRODUCTS.some((p) => p.mrpPaise === p.pricePaise)).toBe(true);
		expect(DEMO_PRODUCTS.some((p) => p.mrpPaise > p.pricePaise)).toBe(true);
	});
});
