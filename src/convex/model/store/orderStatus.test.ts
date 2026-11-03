import { describe, expect, it } from 'vitest';
import {
	ALLOWED_TRANSITIONS,
	OPEN_STATUSES,
	canTransition,
	isOpenStatus,
	type OrderStatus
} from './orderStatus';

const all = Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[];

describe('order state machine', () => {
	it('covers every status exactly once', () => {
		expect([...all].sort()).toEqual(
			['accepted', 'cancelled', 'delivered', 'delivery_failed', 'out_for_delivery', 'packed', 'placed'].sort()
		);
	});

	it('follows the documented happy path', () => {
		expect(canTransition('placed', 'accepted')).toBe(true);
		expect(canTransition('accepted', 'packed')).toBe(true);
		expect(canTransition('packed', 'out_for_delivery')).toBe(true);
		expect(canTransition('out_for_delivery', 'delivered')).toBe(true);
	});

	it('lets an order be cancelled until it is out for delivery', () => {
		for (const from of ['placed', 'accepted', 'packed', 'delivery_failed'] as const) {
			expect(canTransition(from, 'cancelled'), from).toBe(true);
		}
		expect(canTransition('out_for_delivery', 'cancelled')).toBe(false);
	});

	it('lets a failed delivery be tried again or cancelled, and nothing else', () => {
		expect([...ALLOWED_TRANSITIONS.delivery_failed].sort()).toEqual(['cancelled', 'packed']);
	});

	it('treats delivered and cancelled as final', () => {
		expect(ALLOWED_TRANSITIONS.delivered).toEqual([]);
		expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
	});

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

	it('cannot be cancelled and delivered: they are both final and unreachable from each other', () => {
		for (const from of all) {
			if (canTransition(from, 'cancelled')) expect(canTransition(from, 'delivered')).toBe(false);
		}
	});

	it('calls an order open until it is delivered or cancelled', () => {
		expect([...OPEN_STATUSES].sort()).toEqual(
			['accepted', 'delivery_failed', 'out_for_delivery', 'packed', 'placed']
		);
		expect(isOpenStatus('placed')).toBe(true);
		expect(isOpenStatus('delivered')).toBe(false);
		expect(isOpenStatus('cancelled')).toBe(false);
	});
});
