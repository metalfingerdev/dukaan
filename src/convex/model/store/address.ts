/**
 * Validation for a delivery address, shared by `saveAddress` and (later) `placeOrder`. The server
 * never trusts the browser: the phone is normalised to E.164, the area must be one the store
 * delivers to, and text is trimmed and length-limited. Pure, so it is tested without a database.
 */
import { ConvexError } from 'convex/values';
import { normalizeIndianMobile } from '../../otp/phone';

export const MAX_ADDRESSES_PER_USER = 10;

const LIMITS = { label: 30, line1: 200, landmark: 200, contactName: 80 } as const;

export type AddressKind = 'house' | 'hostel' | 'shop';

const MAX_MAPS_URL_LENGTH = 500;

/**
 * Whether `value` is a link a customer may attach to an address: https, on a Google Maps host.
 * The delivery person taps this link, so anything else (another site, `javascript:`, a lookalike
 * such as google.com.evil.com) must be refused. The host is compared exactly, never by "contains".
 */
export function isAllowedMapsUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.protocol !== 'https:' || url.username || url.password) return false;
	const host = url.hostname.toLowerCase();
	if (host === 'maps.app.goo.gl') return true;
	if (host === 'maps.google.com') return true;
	if (host === 'www.google.com' || host === 'google.com') return url.pathname.startsWith('/maps');
	if (host === 'goo.gl') return url.pathname.startsWith('/maps');
	return false;
}

export type AddressInput = {
	label: string;
	kind: AddressKind;
	line1: string;
	area: string;
	landmark?: string;
	contactName: string;
	contactPhone: string;
	lat?: number;
	lng?: number;
	mapsUrl?: string;
};

/** A generous box around India: enough to refuse a broken or faked location, not a delivery radius */
export const isInIndia = ({ lat, lng }: { lat: number; lng: number }) =>
	Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;

/** The fields that get stored (no `userId`, no `isDefault`) */
export type CleanAddress = Omit<AddressInput, 'landmark' | 'lat' | 'lng' | 'mapsUrl'> & {
	landmark?: string;
	lat: number;
	lng: number;
	mapsUrl?: string;
};

const invalid = (field: string, code = 'INVALID_ADDRESS') =>
	new ConvexError({ code, field });

const requiredText = (value: string, field: keyof typeof LIMITS) => {
	const text = value.trim().replace(/\s+/g, ' ');
	if (text.length === 0 || text.length > LIMITS[field]) throw invalid(field);
	return text;
};

/**
 * Returns the cleaned address to store, or throws `ConvexError({ code, field })`. `OUT_OF_AREA`
 * means the area isn't one the store delivers to; `INVALID_ADDRESS` names the offending field.
 */
export function validateAddress(input: AddressInput, deliveryAreas: string[]): CleanAddress {
	const area = input.area.trim();
	if (!deliveryAreas.includes(area)) throw invalid('area', 'OUT_OF_AREA');

	const contactPhone = normalizeIndianMobile(input.contactPhone);
	if (!contactPhone) throw invalid('contactPhone');

	// The pin is required: Kothri has few street names or house numbers, so the rider finds the door
	// from the pin (and a phone call). It comes from the map or the browser's geolocation, as a pair,
	// and must fall inside India, which also catches the 0,0 some phones report when they fail.
	const { lat, lng } = input;
	if (lat === undefined && lng === undefined) throw invalid('pin', 'PIN_REQUIRED');
	if (lat === undefined || lng === undefined || !isInIndia({ lat, lng })) throw invalid('location');

	const clean: CleanAddress = {
		label: requiredText(input.label, 'label'),
		kind: input.kind,
		line1: requiredText(input.line1, 'line1'),
		area,
		contactName: requiredText(input.contactName, 'contactName'),
		contactPhone,
		lat,
		lng
	};

	if (input.landmark !== undefined && input.landmark.trim() !== '') {
		clean.landmark = requiredText(input.landmark, 'landmark');
	}

	if (input.mapsUrl !== undefined && input.mapsUrl.trim() !== '') {
		const mapsUrl = input.mapsUrl.trim();
		if (mapsUrl.length > MAX_MAPS_URL_LENGTH || !isAllowedMapsUrl(mapsUrl)) throw invalid('mapsUrl');
		clean.mapsUrl = mapsUrl;
	}

	return clean;
}

/** A clean, bounded list of areas for `storeSettings.deliveryAreas`; throws on bad input */
export function validateDeliveryAreas(areas: string[]): string[] {
	const clean = [...new Set(areas.map((area) => area.trim().replace(/\s+/g, ' ')))].filter(Boolean);
	if (clean.length === 0 || clean.length > 30 || clean.some((area) => area.length > 80)) {
		throw new ConvexError({ code: 'INVALID_AREAS' });
	}
	return clean;
}
