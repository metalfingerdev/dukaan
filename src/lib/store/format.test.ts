import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPaise } from './format';

describe('formatPaise', () => {
	it('drops the decimals for whole rupees and keeps them otherwise', () => {
		expect(formatPaise(29900)).toBe('₹299');
		expect(formatPaise(29950)).toBe('₹299.50');
		expect(formatPaise(5)).toBe('₹0.05');
		expect(formatPaise(0)).toBe('₹0');
	});

});

describe('IST time formatting', () => {
	// The day changes at midnight India time, not midnight UTC: 19:00 UTC on the 3rd is already
	// 00:30 on the 4th in India, and an order placed then must show the 4th
	it('shows the India date and time, whatever time zone the phone is in', () => {
		expect(formatDateTime(Date.UTC(2026, 10, 3, 19, 0)).toLowerCase()).toBe('4 nov, 12:30 am');
	});

});
