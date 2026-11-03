/// <reference types="vite/client" />
/**
 * Shared setup for the store's convex-test files. The name has two dots, so Convex never deploys
 * it, and it doesn't end in `.test.ts`, so Vitest doesn't run it. The access guards are replaced
 * for every test in src/convex/vitest.setup.ts.
 */
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { internal } from '../_generated/api';
import schema from '../schema';

// Anchored at the project root. A broad glob would also pick up betterAuth/_generated, and
// convex-test takes the first path containing "_generated" as the functions root. Relative
// patterns break too: from store/, "../store/x.ts" is rewritten to "./x.ts".
export const modules = import.meta.glob([
	'/src/convex/_generated/*.js',
	'/src/convex/store/**/*.ts',
	'/src/convex/model/store/*.ts',
	'/src/convex/otp/phone.ts',
	'!/src/convex/**/*.test.ts',
	'!/src/convex/**/*.testutils.ts'
]);

/**
 * A fresh in-memory deployment, by default with the demo catalogue and the placeholder settings,
 * and three callers: two customers and the store admin.
 */
export const setupStore = async ({ seed = true } = {}) => {
	const t = convexTest(schema, modules);
	rateLimiterTest.register(t);
	if (seed) await t.mutation(internal.store.seed.seedDemo, {});
	return {
		t,
		alice: t.withIdentity({ subject: 'alice' }),
		bob: t.withIdentity({ subject: 'bob' }),
		admin: t.withIdentity({ subject: 'admin' })
	};
};

export type StoreTest = Awaited<ReturnType<typeof setupStore>>;
export type Client = StoreTest['alice'];

/** The data of the ConvexError a call throws; fails the test if it doesn't throw one */
export const failure = async (call: Promise<unknown>) => {
	try {
		await call;
	} catch (error) {
		if (error instanceof ConvexError) return error.data as { code: string; [key: string]: unknown };
		throw error;
	}
	throw new Error('expected the call to throw a ConvexError');
};

const productBySlug = (t: StoreTest['t'], slug: string) =>
	t.run(async (ctx) => {
		const product = await ctx.db
			.query('products')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		if (!product) throw new Error(`no demo product ${slug}`);
		return product;
	});

export const idOf = async (t: StoreTest['t'], slug: string) => (await productBySlug(t, slug))._id;

export const stockOf = async (t: StoreTest['t'], slug: string) => (await productBySlug(t, slug)).stock;

export const patchProduct = async (t: StoreTest['t'], slug: string, fields: Record<string, unknown>) => {
	const { _id } = await productBySlug(t, slug);
	await t.run((ctx) => ctx.db.patch(_id, fields));
};
