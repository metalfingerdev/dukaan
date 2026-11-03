import { describe, expect, it } from 'vitest';
import { randomDeliveryCode } from './deliveryCode';

describe('randomDeliveryCode', () => {
	it('is always exactly four digits, zeros included', () => {
		for (let i = 0; i < 2000; i++) expect(randomDeliveryCode()).toMatch(/^\d{4}$/);
	});

});
