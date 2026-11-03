import { describe, expect, it } from 'vitest';
import { formatPaise, percentOff } from './format';

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
