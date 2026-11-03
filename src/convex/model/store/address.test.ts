import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { validateAddress, validateDeliveryAreas, type AddressInput } from './address';

const areas = ['Main Market', 'Boys Hostel'];

const valid: AddressInput = {
	label: 'Home',
	kind: 'house',
	line1: '12, Test Street',
	area: 'Main Market',
	contactName: 'Test Customer',
	contactPhone: '98765 43210'
};

const codeOf = (fn: () => unknown) => {
	try {
		fn();
	} catch (error) {
		if (error instanceof ConvexError) return error.data as { code: string; field?: string };
		throw error;
	}
	return null;
};

describe('validateAddress', () => {
	it('cleans a valid address and normalises the phone to E.164', () => {
		expect(validateAddress(valid, areas)).toEqual({
			label: 'Home',
			kind: 'house',
			line1: '12, Test Street',
			area: 'Main Market',
			contactName: 'Test Customer',
			contactPhone: '+919876543210'
		});
	});

	it('trims and collapses whitespace in text fields', () => {
		const clean = validateAddress(
			{ ...valid, label: '  My   hostel ', line1: ' Room   4 ', landmark: '  near gate ' },
			areas
		);
		expect(clean).toMatchObject({ label: 'My hostel', line1: 'Room 4', landmark: 'near gate' });
	});

	it('drops an empty landmark', () => {
		expect(validateAddress({ ...valid, landmark: '   ' }, areas)).not.toHaveProperty('landmark');
	});

	it('refuses an area the store does not deliver to', () => {
		expect(codeOf(() => validateAddress({ ...valid, area: 'Elsewhere' }, areas))).toEqual({
			code: 'OUT_OF_AREA',
			field: 'area'
		});
		// the match is exact: no guessing at spelling
		expect(codeOf(() => validateAddress({ ...valid, area: 'main market' }, areas))?.code).toBe(
			'OUT_OF_AREA'
		);
	});

	it('refuses phone numbers that are not Indian mobiles', () => {
		for (const contactPhone of ['12345', '+1 415 555 0100', '5876543210', 'abc', '']) {
			expect(codeOf(() => validateAddress({ ...valid, contactPhone }, areas))).toEqual({
				code: 'INVALID_ADDRESS',
				field: 'contactPhone'
			});
		}
	});

	it('refuses empty or oversized text', () => {
		expect(codeOf(() => validateAddress({ ...valid, line1: '   ' }, areas))?.field).toBe('line1');
		expect(codeOf(() => validateAddress({ ...valid, contactName: '' }, areas))?.field).toBe(
			'contactName'
		);
		expect(codeOf(() => validateAddress({ ...valid, label: 'x'.repeat(31) }, areas))?.field).toBe(
			'label'
		);
		expect(codeOf(() => validateAddress({ ...valid, line1: 'x'.repeat(201) }, areas))?.field).toBe(
			'line1'
		);
	});

	it('accepts coordinates as a pair', () => {
		expect(validateAddress({ ...valid, lat: 23.2, lng: 77.4 }, areas)).toMatchObject({
			lat: 23.2,
			lng: 77.4
		});
	});

	it('refuses half a location, out-of-range or non-finite coordinates', () => {
		for (const location of [
			{ lat: 23.2 },
			{ lng: 77.4 },
			{ lat: 91, lng: 77 },
			{ lat: 23, lng: 181 },
			{ lat: Number.NaN, lng: 77 },
			{ lat: Number.POSITIVE_INFINITY, lng: 77 }
		]) {
			expect(codeOf(() => validateAddress({ ...valid, ...location }, areas))?.field).toBe(
				'location'
			);
		}
	});
});

describe('validateDeliveryAreas', () => {
	it('trims, de-duplicates and keeps the order', () => {
		expect(validateDeliveryAreas([' Main  Market ', 'Boys Hostel', 'Main Market', ''])).toEqual([
			'Main Market',
			'Boys Hostel'
		]);
	});

	it('refuses an empty list, too many areas, or a very long name', () => {
		expect(codeOf(() => validateDeliveryAreas([]))?.code).toBe('INVALID_AREAS');
		expect(codeOf(() => validateDeliveryAreas(['  ']))?.code).toBe('INVALID_AREAS');
		expect(
			codeOf(() => validateDeliveryAreas(Array.from({ length: 31 }, (_, i) => `Area ${i}`)))?.code
		).toBe('INVALID_AREAS');
		expect(codeOf(() => validateDeliveryAreas(['x'.repeat(81)]))?.code).toBe('INVALID_AREAS');
	});
});
