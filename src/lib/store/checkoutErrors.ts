import { ConvexError } from 'convex/values';
import { formatPaise } from './format.js';
import { strings } from './strings.js';

/** What the checkout page shows when `placeOrder` refuses, and what to offer next */
export type CheckoutProblem = {
	message: string;
	/** One line per cart item that can't be ordered as it is (only for a changed cart) */
	lines: string[];
	/** Where the customer fixes it: the cart, their address, or nowhere (just try again) */
	fix: 'cart' | 'address' | 'slot' | 'none';
};

type CartProblem = { productId: string; reason: string; available: number };

const lineFor = (problem: CartProblem, names: ReadonlyMap<string, string>) => {
	const name = names.get(problem.productId) ?? 'An item';
	const { problems } = strings.checkout;
	if (problem.reason === 'unavailable') return `${name}: ${problems.unavailable}`;
	if (problem.reason === 'out_of_stock') return `${name}: ${problems.out_of_stock(problem.available)}`;
	if (problem.reason === 'over_limit') return `${name}: ${problems.over_limit(problem.available)}`;
	return `${name}: ${problems.unavailable}`;
};

/**
 * Turns whatever `placeOrder` threw into plain words and a next step. `names` maps product ids to
 * the names shown in the cart, so a changed cart can say which items. Never returns a bare
 * technical message: an unknown error gets a calm "try again".
 */
export function describeCheckoutError(
	error: unknown,
	names: ReadonlyMap<string, string> = new Map()
): CheckoutProblem {
	const { errors } = strings.checkout;
	const unknown: CheckoutProblem = { message: errors.UNKNOWN, lines: [], fix: 'none' };
	if (!(error instanceof ConvexError) || typeof error.data !== 'object' || error.data === null) {
		return unknown;
	}
	const data = error.data as Record<string, unknown>;

	// The rate limiter's own error carries a `kind`, not a `code`
	if (data.kind === 'RateLimited') return { message: errors.RATE_LIMITED, lines: [], fix: 'none' };

	switch (data.code) {
		case 'PRICE_CHANGED':
			return {
				message: errors.PRICE_CHANGED(formatPaise(Number(data.totalPaise))),
				lines: [],
				fix: 'none'
			};
		case 'CART_CHANGED': {
			const problems = Array.isArray(data.problems) ? (data.problems as CartProblem[]) : [];
			return {
				message: errors.CART_CHANGED,
				lines: problems.map((problem) => lineFor(problem, names)),
				fix: 'cart'
			};
		}
		case 'BELOW_MINIMUM':
			return {
				message: errors.BELOW_MINIMUM(formatPaise(Number(data.minOrderPaise))),
				lines: [],
				fix: 'cart'
			};
		case 'TOO_MANY_OPEN_ORDERS':
			return { message: errors.TOO_MANY_OPEN_ORDERS(Number(data.max)), lines: [], fix: 'none' };
		case 'OUT_OF_AREA':
		case 'ADDRESS_NOT_FOUND':
			return { message: errors[data.code], lines: [], fix: 'address' };
		case 'INVALID_SLOT':
			return { message: errors.INVALID_SLOT, lines: [], fix: 'slot' };
		case 'STORE_CLOSED':
		case 'STORE_NOT_SET_UP':
		case 'INVALID_NOTE':
		case 'EMPTY_CART':
			return { message: errors[data.code], lines: [], fix: data.code === 'EMPTY_CART' ? 'cart' : 'none' };
		default:
			return unknown;
	}
}
