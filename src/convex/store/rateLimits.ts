/**
 * Limits on placing orders. Cash on delivery costs the store a trip, so one person (or a script
 * holding a signed-in session) must not be able to flood the order board with fake orders.
 * Placeholders to tune once the real order rate is known.
 */
import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { components } from '../_generated/api';

/** Most orders a customer may have open (placed up to out for delivery) at once */
export const MAX_OPEN_ORDERS = 3;

export const orderRateLimiter = new RateLimiter(components.rateLimiter, {
	// One customer: 10 orders an hour, however they fill it
	placeOrderPerUser: { kind: 'fixed window', rate: 10, period: HOUR }
});

/** Wrong-code guesses at the door. Four digits is only 10,000 options, so guesses are capped per order. */
export const MAX_CODE_ATTEMPTS = 5;
export const deliveryRateLimiter = new RateLimiter(components.rateLimiter, {
	deliveryCodeAttempt: { kind: 'fixed window', rate: MAX_CODE_ATTEMPTS, period: 10 * MINUTE }
});
