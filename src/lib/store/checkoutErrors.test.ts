import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { describeCheckoutError } from './checkoutErrors';

const names = new Map([
	['p1', 'Tomato'],
	['p2', 'Toned Milk']
]);

// Only the branches with real logic are tested here. The wording of the plain refusals is just a
// string lookup, so a test for each would only repeat the table.
describe('describeCheckoutError', () => {
	it('names each item of a changed cart and says how many can still be ordered', () => {
		const problem = describeCheckoutError(
			new ConvexError({
				code: 'CART_CHANGED',
				problems: [
					{ productId: 'p1', reason: 'out_of_stock', available: 1 },
					{ productId: 'p2', reason: 'out_of_stock', available: 0 },
					{ productId: 'gone', reason: 'unavailable', available: 0 }
				]
			}),
			names
		);
		expect(problem.fix).toBe('cart');
		expect(problem.lines).toEqual([
			'Tomato: only 1 available',
			'Toned Milk: out of stock',
			'An item: no longer available'
		]);
	});

	it('recognises the rate limiter, whose error has a kind and no code', () => {
		const problem = describeCheckoutError(new ConvexError({ kind: 'RateLimited', retryAfter: 1000 }), names);
		expect(problem.message).toMatch(/try again later/i);
	});

	it('never shows a technical message for an error it does not know', () => {
		for (const error of [
			new Error('Server Error'),
			new ConvexError('plain string'),
			new ConvexError({ code: 'SOMETHING_NEW' }),
			new ConvexError(null as never),
			undefined
		]) {
			expect(describeCheckoutError(error, names).message).toBe(
				'We could not place your order. Please try again.'
			);
		}
	});
});
