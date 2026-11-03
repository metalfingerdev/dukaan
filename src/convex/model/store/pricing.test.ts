import { describe, expect, it } from 'vitest';
import { priceCart, type Fees } from './pricing';

const fees: Fees = {
	deliveryFeePaise: 2000,
	freeDeliveryAbovePaise: 29900,
	smallCartFeePaise: 1000,
	smallCartBelowPaise: 9900
};

const line = (pricePaise: number, quantity: number, mrpPaise = pricePaise) => ({
	pricePaise,
	mrpPaise,
	quantity
});

describe('priceCart', () => {
	it('sums lines and adds both fees on a small cart', () => {
		const result = priceCart([line(2500, 2), line(3800, 1)], fees);
		expect(result).toEqual({
			subtotalPaise: 8800,
			savingsPaise: 0,
			deliveryFeePaise: 2000,
			smallCartFeePaise: 1000,
			totalPaise: 11800
		});
	});

	it('charges the small-cart fee below the threshold and not at it', () => {
		expect(priceCart([line(9899, 1)], fees).smallCartFeePaise).toBe(1000);
		expect(priceCart([line(9900, 1)], fees).smallCartFeePaise).toBe(0);
	});

	it('makes delivery free at the threshold and not just below it', () => {
		expect(priceCart([line(29899, 1)], fees).deliveryFeePaise).toBe(2000);
		const atThreshold = priceCart([line(29900, 1)], fees);
		expect(atThreshold.deliveryFeePaise).toBe(0);
		expect(atThreshold.totalPaise).toBe(29900);
	});

	it('reports savings against MRP', () => {
		const result = priceCart([line(2500, 2, 3000), line(100, 1, 100)], fees);
		expect(result.savingsPaise).toBe(1000);
	});

	it('never reports negative savings when an MRP is below the price', () => {
		expect(priceCart([line(500, 1, 400)], fees).savingsPaise).toBe(0);
	});

	it('charges nothing for an empty cart', () => {
		expect(priceCart([], fees)).toEqual({
			subtotalPaise: 0,
			savingsPaise: 0,
			deliveryFeePaise: 0,
			smallCartFeePaise: 0,
			totalPaise: 0
		});
	});

	it('rejects amounts that are not whole paise', () => {
		expect(() => priceCart([line(25.5, 1)], fees)).toThrow(RangeError);
		expect(() => priceCart([line(2500, 1.5)], fees)).toThrow(RangeError);
		expect(() => priceCart([line(-100, 1)], fees)).toThrow(RangeError);
	});
});
