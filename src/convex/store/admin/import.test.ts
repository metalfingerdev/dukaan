import { describe, expect, it } from 'vitest';
import { api } from '../../_generated/api';
import type { Id } from '../../_generated/dataModel';
import { planImport, type ExistingProduct } from '../../model/store/productImport';
import { failure, idOf, setupStore as setup, stockOf } from '../harness.testutils';

const { previewImport, applyImport, exportProducts } = api.store.admin.import;

describe('access', () => {
	it('refuses signed-out visitors and customers', async () => {
		const { t, alice } = await setup();
		for (const caller of [t, alice]) {
			const refused = /Not authenticated|Forbidden/;
			await expect(caller.query(previewImport, { rows: [], mode: 'keep' })).rejects.toThrow(refused);
			await expect(caller.mutation(applyImport, { rows: [], mode: 'keep', seen: [] })).rejects.toThrow(refused);
			await expect(caller.query(exportProducts, {})).rejects.toThrow(refused);
		}
	});
});

describe('stock modes', () => {
	const product = (stock: number): ExistingProduct => ({
		_id: 'p1' as Id<'products'>,
		slug: 'paneer-200-g',
		categoryId: 'c1' as Id<'categories'>,
		name: 'Paneer',
		unitLabel: '200 g',
		pricePaise: 8000,
		mrpPaise: 9000,
		stock,
		maxPerOrder: 5,
		isActive: true,
		isFeatured: false
	});
	const plan = (mode: 'keep' | 'add' | 'set', stock: string, held = 0) =>
		planImport({
			rows: [{ slug: 'paneer-200-g', stock }],
			mode,
			products: new Map([['paneer-200-g', product(10)]]),
			categories: [],
			held: new Map([['p1' as Id<'products'>, held]])
		}).rows[0];

	it('keep leaves stock, add adds it, and set subtracts what open orders hold', () => {
		expect(plan('keep', '40')).toMatchObject({ kind: 'update', stockFrom: 10, stockTo: 10 });
		expect(plan('add', '40')).toMatchObject({ kind: 'update', stockTo: 50 });
		// 40 on the shelf, 6 of them already sold in orders nobody has picked: 34 left to sell
		expect(plan('set', '40', 6)).toMatchObject({ kind: 'update', stockTo: 34 });
		expect(plan('set', '4', 6)).toMatchObject({ kind: 'error', problem: { reason: 'below_held' } });
	});

	it('a blank cell keeps the current value', () => {
		const row = planImport({
			rows: [{ slug: 'paneer-200-g', price: '85', mrp: '', stock: '' }],
			mode: 'set',
			products: new Map([['paneer-200-g', product(10)]]),
			categories: [],
			held: new Map()
		}).rows[0];
		expect(row).toMatchObject({
			kind: 'update',
			stockTo: 10,
			fields: { pricePaise: 8500, mrpPaise: 9000, maxPerOrder: 5 }
		});
	});
});

describe('applyImport', () => {
	it('an export imports back as updates that change nothing', async () => {
		const { t, admin } = await setup();
		const { rows } = await admin.query(exportProducts, {});
		const before = await t.run((ctx) => ctx.db.query('products').collect());
		const result = await admin.mutation(applyImport, { rows, mode: 'keep', seen: [] });
		expect(result).toMatchObject({ created: 0, updated: rows.length, categoriesCreated: 0 });
		expect(await t.run((ctx) => ctx.db.query('products').collect())).toEqual(before);
	});

	it('is all or nothing: one bad row stops the whole file', async () => {
		const { t, admin } = await setup();
		const before = await stockOf(t, 'tomato-500g');
		const rows: Record<string, string>[] = [
			{ slug: 'tomato-500g', stock: '99' },
			{ name: 'Broken', unit: '1 kg', category: 'Dairy & Eggs', price: 'abc' }
		];
		expect(await failure(admin.mutation(applyImport, { rows, mode: 'add', seen: [] }))).toMatchObject({
			code: 'IMPORT_HAS_ERRORS'
		});
		expect(await stockOf(t, 'tomato-500g')).toBe(before);
	});

	it('refuses a count made against stock that has since moved', async () => {
		const { t, admin } = await setup();
		const rows = [{ slug: 'tomato-500g', stock: '30' }];
		const { seen } = await admin.query(previewImport, { rows, mode: 'set' });
		const id = await idOf(t, 'tomato-500g');
		await t.run(async (ctx) => {
			const product = (await ctx.db.get(id))!;
			await ctx.db.patch(id, { stock: product.stock - 1 }); // an order sold one after the preview
		});
		const moved = await stockOf(t, 'tomato-500g');
		expect(await failure(admin.mutation(applyImport, { rows, mode: 'set', seen }))).toMatchObject({
			code: 'STOCK_CHANGED'
		});
		expect(await stockOf(t, 'tomato-500g')).toBe(moved);
	});

	it('creates a new category once and records opening stock as received', async () => {
		const { t, admin } = await setup();
		const rows: Record<string, string>[] = [
			{ name: 'Sattu', unit: '500 g', category: 'Flours', price: '60', stock: '8' },
			{ name: 'Besan', unit: '500 g', category: 'flours', price: '70' }
		];
		expect(await admin.mutation(applyImport, { rows, mode: 'keep', seen: [] })).toMatchObject({
			created: 2,
			categoriesCreated: 1
		});
		const sattu = await idOf(t, 'sattu-500-g');
		const log = await t.run((ctx) =>
			ctx.db
				.query('stockAdjustments')
				.withIndex('by_productId', (q) => q.eq('productId', sattu))
				.collect()
		);
		expect(log).toMatchObject([{ delta: 8, reason: 'received' }]);
	});
});
