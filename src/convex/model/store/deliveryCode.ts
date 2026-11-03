/**
 * The 4-digit code the customer reads out to the delivery partner, which is what makes "delivered"
 * trustworthy. Drawn from the platform's secure random source, not `Math.random`, and without
 * modulo bias: 2^32 is not a multiple of 10000, so values at or above the largest multiple of
 * 10000 below it are redrawn.
 */
const LIMIT = 4_294_960_000; // 429496 * 10000, the largest multiple of 10000 that fits in 32 bits

export function randomDeliveryCode(): string {
	const buffer = new Uint32Array(1);
	do {
		crypto.getRandomValues(buffer);
	} while (buffer[0] >= LIMIT);
	return String(buffer[0] % 10_000).padStart(4, '0');
}
