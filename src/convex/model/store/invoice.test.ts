import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import {
	MAX_INVOICE_NUMBER_LENGTH,
	financialYear,
	formatInvoiceNumber,
	splitInclusiveTax,
	validateInvoiceDetails
} from './invoice';

const istMidnight = (year: number, month: number, day: number) => Date.UTC(year, month, day) - 5.5 * 60 * 60 * 1000;

describe('financialYear', () => {
	it('turns over at midnight on 1 April India time, not UTC', () => {
		expect(financialYear(Date.UTC(2026, 10, 15))).toBe('26-27');
		expect(financialYear(istMidnight(2027, 3, 1) - 1)).toBe('26-27'); // 31 Mar 23:59:59 IST
		expect(financialYear(istMidnight(2027, 3, 1))).toBe('27-28'); // 1 Apr 00:00 IST, still 31 Mar in UTC
		expect(financialYear(istMidnight(2100, 0, 10))).toBe('99-00');
	});
});

describe('invoice numbers', () => {
	it('stay within 16 characters with the longest prefix', () => {
		const number = formatInvoiceNumber('ABC', '26-27', 123);
		expect(number).toBe('ABC/26-27/000123');
		expect(formatInvoiceNumber('ABC', '26-27', 999_999).length).toBeLessThanOrEqual(MAX_INVOICE_NUMBER_LENGTH);
	});
});

describe('splitInclusiveTax', () => {
	it('takes tax out of the price, so the parts add up to exactly what was paid', () => {
		expect(splitInclusiveTax({ amountPaise: 11_800, gstRatePercent: 18 })).toEqual({
			taxablePaise: 10_000,
			cgstPaise: 900,
			sgstPaise: 900
		});
		for (const [amountPaise, gstRatePercent] of [
			[2_999, 5],
			[101, 12],
			[7, 18],
			[123_457, 28]
		]) {
			const split = splitInclusiveTax({ amountPaise, gstRatePercent })!;
			expect(split.taxablePaise + split.cgstPaise + split.sgstPaise).toBe(amountPaise);
			expect(Math.abs(split.cgstPaise - split.sgstPaise)).toBeLessThanOrEqual(1);
		}
		expect(splitInclusiveTax({ amountPaise: 5_000 })).toBeNull();
	});
});

describe('validateInvoiceDetails', () => {
	const fieldOf = (input: Parameters<typeof validateInvoiceDetails>[0]) => {
		try {
			validateInvoiceDetails(input);
		} catch (error) {
			if (error instanceof ConvexError) return (error.data as { field: string }).field;
			throw error;
		}
		return null;
	};
	const valid = { legalName: 'Shop', addressLine: 'Main road', invoicePrefix: 'dk' };

	it('keeps the prefix short enough for a 16-character number, and a GSTIN to its shape', () => {
		expect(validateInvoiceDetails({ ...valid, gstin: ' 23aaaaa0000a1z5 ' })).toEqual({
			...valid,
			invoicePrefix: 'DK',
			gstin: '23AAAAA0000A1Z5'
		});
		expect(fieldOf({ ...valid, invoicePrefix: 'ABCD' })).toBe('invoicePrefix');
		expect(fieldOf({ ...valid, invoicePrefix: 'D/K' })).toBe('invoicePrefix');
		expect(fieldOf({ ...valid, gstin: '23AAAAA0000A1Z' })).toBe('gstin');
		expect(validateInvoiceDetails({ ...valid, gstin: '  ' })).not.toHaveProperty('gstin');
	});
});
