import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPaise, formatSlot, percentOff } from './format';

describe('formatPaise', () => {
	it('drops the decimals for whole rupees and keeps them otherwise', () => {
		expect(formatPaise(29900)).toBe('₹299');
		expect(formatPaise(29950)).toBe('₹299.50');
		expect(formatPaise(5)).toBe('₹0.05');
		expect(formatPaise(0)).toBe('₹0');
	});

	it('groups digits the Indian way', () => {
		expect(formatPaise(123456700)).toBe('₹12,34,567');
	});
});

describe('IST time formatting', () => {
	// The day changes at midnight India time, not midnight UTC: 19:00 UTC on the 3rd is already
	// 00:30 on the 4th in India, and an order placed then must show the 4th
	it('shows the India date and time, whatever time zone the phone is in', () => {
		expect(formatDateTime(Date.UTC(2026, 10, 3, 19, 0)).toLowerCase()).toBe('4 nov, 12:30 am');
	});

	it('shows a slot that ends in a different hour as one range', () => {
		const eleven = Date.UTC(2026, 10, 3, 5, 30);
		expect(formatSlot(eleven, 60).toLowerCase()).toBe('11:00 am to 12:00 pm');
	});
});

describe('percentOff', () => {
	it('is the discount from MRP, rounded', () => {
		expect(percentOff(2500, 3000)).toBe(17);
		expect(percentOff(2900, 3000)).toBe(3);
	});

	it('is null when there is no discount', () => {
		expect(percentOff(2000, 2000)).toBeNull();
		expect(percentOff(2000, 1500)).toBeNull();
	});
});
