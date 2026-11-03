import { describe, expect, it } from 'vitest';
import { ALLOWED_TRANSITIONS, canTransition, type OrderStatus } from './orderStatus';

const all = Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[];

describe('order state machine', () => {
	it('never allows skipping a step or going backwards', () => {
		expect(canTransition('placed', 'packed')).toBe(false);
		expect(canTransition('placed', 'delivered')).toBe(false);
		expect(canTransition('accepted', 'placed')).toBe(false);
		expect(canTransition('delivered', 'out_for_delivery')).toBe(false);
		expect(canTransition('cancelled', 'placed')).toBe(false);
	});

	it('has no way into "placed": only placeOrder creates one', () => {
		for (const from of all) expect(canTransition(from, 'placed'), from).toBe(false);
	});

});
