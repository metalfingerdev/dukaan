import { describe, expect, it } from 'vitest';
import { randomDeliveryCode } from './deliveryCode';

describe('randomDeliveryCode', () => {
	it('is always exactly four digits, zeros included', () => {
		for (let i = 0; i < 2000; i++) expect(randomDeliveryCode()).toMatch(/^\d{4}$/);
	});

	it('varies, and reaches both ends of the range over many draws', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 5000; i++) seen.add(randomDeliveryCode());
		// 5000 draws from 10000 values: about 3900 distinct. Far fewer would mean a stuck generator.
		expect(seen.size).toBeGreaterThan(3000);
		const numbers = [...seen].map(Number);
		expect(Math.min(...numbers)).toBeLessThan(200);
		expect(Math.max(...numbers)).toBeGreaterThan(9800);
	});

	it('has no digit that is noticeably over- or under-used', () => {
		const counts = new Array(10).fill(0);
		const draws = 4000;
		for (let i = 0; i < draws; i++) for (const digit of randomDeliveryCode()) counts[Number(digit)]++;
		const expected = (draws * 4) / 10;
		for (const count of counts) expect(Math.abs(count - expected)).toBeLessThan(expected * 0.2);
	});
});
