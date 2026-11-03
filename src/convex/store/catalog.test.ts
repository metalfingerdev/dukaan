/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from '../_generated/api';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../model/store/demoCatalog';
import schema from '../schema';

// See seed.test.ts for why the patterns are anchored at the project root
const modules = import.meta.glob([
	'/src/convex/_generated/*.js',
	'/src/convex/store/*.ts',
	'/src/convex/model/store/*.ts',
	'!/src/convex/**/*.test.ts'
]);

const seeded = async () => {
	const t = convexTest(schema, modules);
	await t.mutation(internal.store.seed.seedDemo, {});
	return t;
};

const PRODUCT_KEYS = [
	'_id',
	'imageUrl',
	'inStock',
	'lowStock',
	'maxQuantity',
	'mrpPaise',
	'name',
	'pricePaise',
	'slug',
	'unitLabel'
];

// Everything a visitor must never see
const PRIVATE_PRODUCT_FIELDS = [
	'stock',
	'lowStockAt',
	'maxPerOrder',
	'isActive',
	'isFeatured',
	'categoryId',
	'gstRatePercent',
	'hsn',
	'imageId',
	'_creationTime'
];

describe('catalogue is public and returns projections only', () => {
	it('lets a signed-out visitor call every query', async () => {
		const t = await seeded();
		await expect(t.query(api.store.catalog.getStoreInfo, {})).resolves.not.toBeNull();
		await expect(t.query(api.store.catalog.listCategories, {})).resolves.toHaveLength(
			DEMO_CATEGORIES.length
		);
		await expect(t.query(api.store.catalog.listFeatured, {})).resolves.not.toHaveLength(0);
		await expect(
			t.query(api.store.catalog.listProducts, { categorySlug: 'dairy-eggs' })
		).resolves.not.toBeNull();
		await expect(
			t.query(api.store.catalog.getProduct, { slug: 'toned-milk-500ml' })
		).resolves.not.toBeNull();
		await expect(t.query(api.store.catalog.searchProducts, { q: 'milk' })).resolves.not.toHaveLength(
			0
		);
		await expect(t.query(api.store.catalog.getProductsByIds, { ids: [] })).resolves.toEqual([]);
	});

	it('exposes exactly the public product fields and no private ones', async () => {
		const t = await seeded();
		const result = await t.query(api.store.catalog.listProducts, { categorySlug: 'dairy-eggs' });
		expect(result!.products.length).toBeGreaterThan(0);
		for (const product of result!.products) {
			expect(Object.keys(product).sort()).toEqual(PRODUCT_KEYS);
			for (const field of PRIVATE_PRODUCT_FIELDS) expect(product).not.toHaveProperty(field);
		}
	});

	it('shows the real count only while stock is low', async () => {
		const t = await seeded();
		const result = await t.query(api.store.catalog.listProducts, {
			categorySlug: 'fruits-vegetables'
		});
		for (const product of result!.products) {
			if (product.lowStock) {
				expect(Object.keys(product).sort()).toEqual([...PRODUCT_KEYS, 'stockLeft'].sort());
			} else {
				expect(product).not.toHaveProperty('stockLeft');
			}
		}
		expect(result!.products.find((p) => p.slug === 'apple-4pc')!.stockLeft).toBe(3);
	});

	it('keeps private settings out of getStoreInfo', async () => {
		const t = await seeded();
		await t.run(async (ctx) => {
			const settings = await ctx.db.query('storeSettings').first();
			await ctx.db.patch(settings!._id, {
				upiVpa: 'shop@upi',
				gstin: '22AAAAA0000A1Z5',
				storePhone: '+919999999999'
			});
		});
		const info = await t.query(api.store.catalog.getStoreInfo, {});
		expect(info).not.toHaveProperty('upiVpa');
		expect(info).not.toHaveProperty('gstin');
		expect(info).not.toHaveProperty('legalName');
		expect(info).not.toHaveProperty('addressLine');
		// The areas customers can pick are public by nature
		expect(info!.deliveryAreas.length).toBeGreaterThan(0);
		expect(info!.storePhone).toBe('+919999999999');
	});

	it('returns null from getStoreInfo before the store is set up', async () => {
		const t = convexTest(schema, modules);
		await expect(t.query(api.store.catalog.getStoreInfo, {})).resolves.toBeNull();
	});
});

describe('stock flags', () => {
	it('reports out of stock, low stock and the most a customer can add', async () => {
		const t = await seeded();
		const dairy = await t.query(api.store.catalog.listProducts, { categorySlug: 'dairy-eggs' });
		const butter = dairy!.products.find((p) => p.slug === 'butter-100g')!;
		expect(butter).toMatchObject({ inStock: false, lowStock: false, maxQuantity: 0 });

		const fruit = await t.query(api.store.catalog.listProducts, {
			categorySlug: 'fruits-vegetables'
		});
		// stock 3, lowStockAt 5, maxPerOrder 5: low, and capped by stock
		expect(fruit!.products.find((p) => p.slug === 'apple-4pc')).toMatchObject({
			inStock: true,
			lowStock: true,
			maxQuantity: 3
		});
		// plenty of stock: capped by maxPerOrder, and not low
		expect(fruit!.products.find((p) => p.slug === 'banana-6pc')).toMatchObject({
			inStock: true,
			lowStock: false,
			maxQuantity: 5
		});
	});
});

describe('hidden rows never appear', () => {
	it('hides inactive products from every query', async () => {
		const t = await seeded();
		await t.run(async (ctx) => {
			const milk = await ctx.db
				.query('products')
				.withIndex('by_slug', (q) => q.eq('slug', 'toned-milk-500ml'))
				.unique();
			await ctx.db.patch(milk!._id, { isActive: false });
		});
		const dairy = await t.query(api.store.catalog.listProducts, { categorySlug: 'dairy-eggs' });
		expect(dairy!.products.map((p) => p.slug)).not.toContain('toned-milk-500ml');
		const featured = await t.query(api.store.catalog.listFeatured, {});
		expect(featured.map((p) => p.slug)).not.toContain('toned-milk-500ml');
		await expect(
			t.query(api.store.catalog.getProduct, { slug: 'toned-milk-500ml' })
		).resolves.toBeNull();
		const found = await t.query(api.store.catalog.searchProducts, { q: 'Toned Milk' });
		expect(found.map((p) => p.slug)).not.toContain('toned-milk-500ml');
		const sibling = await t.query(api.store.catalog.getProduct, { slug: 'curd-400g' });
		expect(sibling!.related.map((p) => p.slug)).not.toContain('toned-milk-500ml');
	});

	it('hides inactive categories', async () => {
		const t = await seeded();
		await t.run(async (ctx) => {
			const category = await ctx.db
				.query('categories')
				.withIndex('by_slug', (q) => q.eq('slug', 'stationery'))
				.unique();
			await ctx.db.patch(category!._id, { isActive: false });
		});
		const categories = await t.query(api.store.catalog.listCategories, {});
		expect(categories.map((c) => c.slug)).not.toContain('stationery');
		await expect(
			t.query(api.store.catalog.listProducts, { categorySlug: 'stationery' })
		).resolves.toBeNull();
	});

	it('returns null for an unknown category or product', async () => {
		const t = await seeded();
		await expect(
			t.query(api.store.catalog.listProducts, { categorySlug: 'nope' })
		).resolves.toBeNull();
		await expect(t.query(api.store.catalog.getProduct, { slug: 'nope' })).resolves.toBeNull();
	});
});

describe('browsing', () => {
	it('lists categories in sort order', async () => {
		const t = await seeded();
		const categories = await t.query(api.store.catalog.listCategories, {});
		expect(categories.map((c) => c.slug)).toEqual(DEMO_CATEGORIES.map((c) => c.slug));
	});

	it('lists only featured products as featured', async () => {
		const t = await seeded();
		const featured = await t.query(api.store.catalog.listFeatured, {});
		const expected = DEMO_PRODUCTS.filter((p) => p.isFeatured).map((p) => p.slug);
		expect(featured.map((p) => p.slug).sort()).toEqual([...expected].sort());
	});

	it('gives a product its category and related products without itself', async () => {
		const t = await seeded();
		const result = await t.query(api.store.catalog.getProduct, { slug: 'toned-milk-500ml' });
		expect(result!.category).toEqual({ name: 'Dairy & Eggs', slug: 'dairy-eggs' });
		expect(result!.product.slug).toBe('toned-milk-500ml');
		expect(result!.related.length).toBeGreaterThan(0);
		expect(result!.related.map((p) => p.slug)).not.toContain('toned-milk-500ml');
	});

	it('searches by name and ignores too-short queries', async () => {
		const t = await seeded();
		const found = await t.query(api.store.catalog.searchProducts, { q: 'noodles' });
		expect(found.map((p) => p.slug)).toContain('instant-noodles-70g');
		await expect(t.query(api.store.catalog.searchProducts, { q: 'm' })).resolves.toEqual([]);
		await expect(t.query(api.store.catalog.searchProducts, { q: '   ' })).resolves.toEqual([]);
	});
});

describe('getProductsByIds', () => {
	it('skips malformed, unknown and hidden ids instead of failing', async () => {
		const t = await seeded();
		const { good, hidden } = await t.run(async (ctx) => {
			const products = await ctx.db.query('products').take(2);
			await ctx.db.patch(products[1]._id, { isActive: false });
			return { good: products[0], hidden: products[1] };
		});
		const result = await t.query(api.store.catalog.getProductsByIds, {
			ids: [good._id, hidden._id, 'not-an-id', '']
		});
		expect(result.map((p) => p._id)).toEqual([good._id]);
	});

	it('refuses more than 50 ids', async () => {
		const t = await seeded();
		const ids = Array.from({ length: 51 }, (_, i) => `id${i}`);
		await expect(t.query(api.store.catalog.getProductsByIds, { ids })).rejects.toThrow(
			/At most 50/
		);
	});
});
