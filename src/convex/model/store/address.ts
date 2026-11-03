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
};

/** The fields that get stored (no `userId`, no `isDefault`) */
export type CleanAddress = Omit<AddressInput, 'landmark' | 'lat' | 'lng'> & {
	landmark?: string;
	lat?: number;
	lng?: number;
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

	const clean: CleanAddress = {
		label: requiredText(input.label, 'label'),
		kind: input.kind,
		line1: requiredText(input.line1, 'line1'),
		area,
		contactName: requiredText(input.contactName, 'contactName'),
		contactPhone
	};

	if (input.landmark !== undefined && input.landmark.trim() !== '') {
		clean.landmark = requiredText(input.landmark, 'landmark');
	}

	// Coordinates come as a pair, from the browser's geolocation; anything else is dropped
	if (input.lat !== undefined || input.lng !== undefined) {
		const { lat, lng } = input;
		if (
			lat === undefined ||
			lng === undefined ||
			!Number.isFinite(lat) ||
			!Number.isFinite(lng) ||
			Math.abs(lat) > 90 ||
			Math.abs(lng) > 180
		) {
			throw invalid('location');
		}
		clean.lat = lat;
		clean.lng = lng;
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
