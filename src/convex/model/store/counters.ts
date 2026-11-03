/**
 * Sequences kept in the `counters` table: `order` for order numbers (and later
 * `invoice:<financial year>`). One hot document per key, which is fine at one store's order rate:
 * concurrent callers conflict and Convex retries them, so a number is never handed out twice. The
 * increment is part of the caller's transaction, so if the caller fails afterwards the counter
 * rolls back with it and no number is wasted, which is what makes gap-free invoice numbers possible.
 */
import type { MutationCtx } from '../../_generated/server';

export async function nextCounterValue(ctx: MutationCtx, key: string) {
	const counter = await ctx.db
		.query('counters')
		.withIndex('by_key', (q) => q.eq('key', key))
		.unique();
	if (!counter) {
		await ctx.db.insert('counters', { key, value: 1 });
		return 1;
	}
	const value = counter.value + 1;
	await ctx.db.patch(counter._id, { value });
	return value;
}
