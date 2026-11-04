import { isAllowedMapsUrl } from '#convex/model/store/address.js';

type Destination = {
	line1: string;
	area?: string;
	landmark?: string;
	lat?: number;
	lng?: number;
	mapsUrl?: string;
};

/**
 * Where the delivery partner's Maps button goes. A saved pin is exact, so it wins; then the link
 * the customer shared (only if it is a Google Maps link, since the partner taps it); otherwise a
 * Maps search on the address text. Everything is URL-encoded.
 */
export function directionsUrl(to: Destination): string {
	if (typeof to.lat === 'number' && typeof to.lng === 'number') {
		return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${to.lat},${to.lng}`)}`;
	}
	if (to.mapsUrl && isAllowedMapsUrl(to.mapsUrl)) return to.mapsUrl;
	const text = [to.line1, to.landmark, to.area].filter(Boolean).join(', ');
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}
