import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../_generated/api';
import { failure, idOf, setupStore as setup } from '../harness.testutils';

// 12:00 IST on 3 Nov 2026: inside the placeholder opening hours
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.UTC(2026, 10, 3, 6, 30));
});
afterEach(() => vi.useRealTimers());

const { createProduct, updateProduct, setProductImage, generateImageUploadUrl, listProducts } =
	api.store.admin.products;
const { createCategory, updateCategory, moveCategory, listCategories } = api.store.admin.categories;

const categoryId = async (t: Awaited<ReturnType<typeof setup>>['t'], slug: string) =>
	(await t.run((ctx) =>
		ctx.db
			.query('categories')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique()
	))!._id;

const newProduct = async (t: Awaited<ReturnType<typeof setup>>['t'], overrides = {}) => ({
	categoryId: await categoryId(t, 'dairy-eggs'),
	name: 'Test Curd',
	unitLabel: '400 g',
	pricePaise: 4500,
	mrpPaise: 5000,
	maxPerOrder: 5,
	isActive: true,
	isFeatured: false,
	stock: 12,
	...overrides
});

describe('access', () => {
	it('refuses signed-out visitors and customers on every admin catalogue function, and writes nothing', async () => {
		const { t, alice } = await setup();
		const before = await t.run(async (ctx) => (await ctx.db.query('products').collect()).length);
		const product = await newProduct(t);
		const productId = await idOf(t, 'tomato-500g');
		const catId = product.categoryId;
		for (const caller of [t, alice]) {
			const refused = /Not authenticated|Forbidden/;
			await expect(caller.query(listProducts, {})).rejects.toThrow(refused);
			await expect(caller.query(listCategories, {})).rejects.toThrow(refused);
			await expect(caller.mutation(createProduct, product)).rejects.toThrow(refused);
			const { stock: _stock, ...fields } = product;
			await expect(caller.mutation(updateProduct, { productId, ...fields })).rejects.toThrow(refused);
			await expect(caller.mutation(generateImageUploadUrl, {})).rejects.toThrow(refused);
			await expect(caller.mutation(setProductImage, { productId, imageId: null })).rejects.toThrow(refused);
			await expect(caller.mutation(createCategory, { name: 'Sneaky' })).rejects.toThrow(refused);
			await expect(
				caller.mutation(updateCategory, { categoryId: catId, name: 'x', isActive: false })
			).rejects.toThrow(refused);
			await expect(caller.mutation(moveCategory, { categoryId: catId, direction: 'up' })).rejects.toThrow(
				refused
			);
		}
		expect(await t.run(async (ctx) => (await ctx.db.query('products').collect()).length)).toBe(before);
	});
});

describe('createProduct', () => {
	it('records the opening stock as a received adjustment', async () => {
		const { t, admin } = await setup();
		const id = await admin.mutation(createProduct, await newProduct(t));
		const { product, adjustments } = await t.run(async (ctx) => ({
			product: await ctx.db.get(id),
			adjustments: await ctx.db
				.query('stockAdjustments')
				.withIndex('by_productId', (q) => q.eq('productId', id))
				.collect()
		}));
		expect(product).toMatchObject({ stock: 12, slug: 'test-curd-400-g' });
		expect(adjustments).toMatchObject([{ delta: 12, stockAfter: 12, reason: 'received', actorId: 'admin' }]);
	});

	it('refuses a price above the MRP and gives a repeated name its own link', async () => {
		const { t, admin } = await setup();
		expect(await failure(admin.mutation(createProduct, await newProduct(t, { pricePaise: 5100 })))).toMatchObject({
			code: 'INVALID_PRODUCT',
			field: 'mrpPaise'
		});
		const first = await admin.mutation(createProduct, await newProduct(t));
		const second = await admin.mutation(createProduct, await newProduct(t));
		const slugs = await t.run(async (ctx) => [(await ctx.db.get(first))!.slug, (await ctx.db.get(second))!.slug]);
		expect(slugs).toEqual(['test-curd-400-g', 'test-curd-400-g-2']);
	});
});

describe('hiding a category', () => {
	it('takes its products off the storefront and refuses an order containing one', async () => {
		const { t, alice, admin } = await setup();
		const tomato = await idOf(t, 'tomato-500g');
		await alice.mutation(api.store.cart.setQuantity, { productId: tomato, quantity: 2 });
		const addressId = (
			await alice.mutation(api.store.addresses.saveAddress, {
				label: 'Home',
				kind: 'house',
				line1: '12, Test Street',
				area: 'Main Market (placeholder)',
				contactName: 'Test Customer',
				contactPhone: '9876543210'
			})
		).addressId;
		const veg = await categoryId(t, 'fruits-vegetables');

		await admin.mutation(updateCategory, { categoryId: veg, name: 'Fruits & Vegetables', isActive: false });

		expect(await t.query(api.store.catalog.searchProducts, { q: 'tomato' })).toEqual([]);
		expect(await t.query(api.store.catalog.getProduct, { slug: 'tomato-500g' })).toBeNull();
		expect(await t.query(api.store.catalog.getProductsByIds, { ids: [tomato] })).toEqual([]);
		expect(await alice.query(api.store.cart.getCart, {})).toEqual([]);
		const problem = await failure(
			alice.mutation(api.store.orders.placeOrder, {
				addressId,
				paymentMethod: 'cod',
				idempotencyKey: 'hidden-category-key',
				expectedTotalPaise: 7000
			})
		);
		expect(problem).toMatchObject({ code: 'CART_CHANGED', problems: [{ productId: tomato, reason: 'unavailable' }] });

		// Showing the category again brings the product back as it was
		await admin.mutation(updateCategory, { categoryId: veg, name: 'Fruits & Vegetables', isActive: true });
		expect(await t.query(api.store.catalog.searchProducts, { q: 'tomato' })).toHaveLength(1);
	});
});
