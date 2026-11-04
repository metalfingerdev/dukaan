import { describe, expect, it } from 'vitest';
import { directionsUrl } from './directions';

const address = { line1: 'Room 12 & 13, Boys Hostel', area: 'Govt College', landmark: 'Near the "tea" stall' };

describe('directionsUrl', () => {
	it('prefers the saved pin over a shared link', () => {
		const url = directionsUrl({ ...address, lat: 23.1, lng: 76.5, mapsUrl: 'https://maps.app.goo.gl/abc' });
		expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=23.1%2C76.5');
	});

	it('uses the shared link only when it is a Google Maps link', () => {
		expect(directionsUrl({ ...address, mapsUrl: 'https://maps.app.goo.gl/abc' })).toBe('https://maps.app.goo.gl/abc');
		const url = directionsUrl({ ...address, mapsUrl: 'https://evil.example/maps' });
		expect(url.startsWith('https://www.google.com/maps/search/')).toBe(true);
	});

	it('searches the address text, encoded, when there is no pin or link', () => {
		const url = new URL(directionsUrl(address));
		expect(url.searchParams.get('query')).toBe('Room 12 & 13, Boys Hostel, Near the "tea" stall, Govt College');
		expect(url.search).not.toContain(' ');
	});
});
