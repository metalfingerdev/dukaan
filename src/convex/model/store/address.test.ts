import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { validateAddress, type AddressInput } from './address';

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

// The delivery person taps this link, so what it may point at is a security matter
describe('Google Maps link', () => {
	const accepted = (mapsUrl: string) => validateAddress({ ...valid, mapsUrl }, areas).mapsUrl;

	it('keeps the real forms of a shared Google Maps link', () => {
		for (const url of [
			'https://maps.app.goo.gl/AbC123xyz',
			'https://www.google.com/maps/place/Kothri+Kalan/@23.2,77.4,17z',
			'https://google.com/maps?q=23.2,77.4',
			'https://maps.google.com/?q=23.2,77.4',
			'https://goo.gl/maps/AbC123'
		]) {
			expect(accepted(`  ${url}  `), url).toBe(url);
		}
	});

	it('refuses anything that is not https on a Google Maps host', () => {
		for (const url of [
			'javascript:alert(1)',
			'http://maps.app.goo.gl/AbC123',
			'https://google.com.evil.com/maps/x',
			'https://evil.com/maps.app.goo.gl',
			'https://evil.com/?next=https://www.google.com/maps',
			'https://www.google.com/search?q=maps',
			'https://user:pass@www.google.com/maps/x',
			'https://maps.app.goo.gl.evil.com/x',
			'not a url',
			`https://www.google.com/maps/${'x'.repeat(500)}`
		]) {
			expect(codeOf(() => accepted(url)), url).toEqual({ code: 'INVALID_ADDRESS', field: 'mapsUrl' });
		}
	});

});
