/**
 * Validation for the store settings the admin edits in /admin/settings. Pure, so it is tested
 * without a database. Throws `ConvexError({ code: 'INVALID_SETTINGS', field })` naming the first
 * bad field, so the page can show the message next to it. Money is integer paise.
 */
import { ConvexError } from 'convex/values';
import { validateDeliveryAreas } from './address';

const MINUTES_PER_DAY = 24 * 60;

/**
 * Bounds that catch a typo (an extra zero, a fee typed in paise), not business rules. The store
 * decides the values; these only refuse ones no grocery store would mean.
 */
export const SETTINGS_LIMITS = {
	minEtaMinutes: 5,
	maxEtaMinutes: 240,
	maxAmountPaise: 10_000 * 100
} as const;

/** The fields the settings form saves. The open/closed switch has its own mutation. */
export type SettingsInput = {
	opensAtMinute: number;
	closesAtMinute: number;
	etaMinutes: number;
	deliveryAreas: string[];
	minOrderPaise: number;
	deliveryFeePaise: number;
	freeDeliveryAbovePaise: number;
	smallCartFeePaise: number;
	smallCartBelowPaise: number;
	/** Missing or blank removes it */
	storePhone?: string;
	/** Missing or blank removes it */
	upiVpa?: string;
};

export type SettingsField = keyof SettingsInput | 'hours';

const invalid = (field: SettingsField) => new ConvexError({ code: 'INVALID_SETTINGS', field });

/**
 * An Indian mobile or landline number as E.164, or `null`. A landline is its STD code without the
 * leading 0 plus the subscriber number, 10 digits in all, like a mobile. Accepts
 * "+91 98765 43210", "09876543210", "0755-2551234".
 */
export function normalizeIndianPhone(input: string): string | null {
	let digits = input.replace(/[\s\-().]/g, '');
	if (digits.startsWith('+91')) digits = digits.slice(3);
	else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
	else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
	return /^[1-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

// name@handle, as UPI apps show it: "shopname@okaxis", "9876543210@ybl". Case doesn't matter in a
// UPI id, so it is stored in lower case.
const UPI_VPA = /^[a-z0-9][a-z0-9._-]{1,99}@[a-z][a-z0-9]{1,49}$/;

const isMinuteOfDay = (value: number) =>
	Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY;

const isAmount = (value: number) =>
	Number.isSafeInteger(value) && value >= 0 && value <= SETTINGS_LIMITS.maxAmountPaise;

const blankToUndefined = (value: string | undefined) => {
	const text = value?.trim();
	return text ? text : undefined;
};

/** The cleaned settings to store, or throws naming the bad field */
export function validateSettings(input: SettingsInput) {
	if (!isMinuteOfDay(input.opensAtMinute)) throw invalid('opensAtMinute');
	if (!isMinuteOfDay(input.closesAtMinute)) throw invalid('closesAtMinute');
	// Equal times would mean "closed all day"; the open/closed switch is the way to say that
	if (input.opensAtMinute === input.closesAtMinute) throw invalid('hours');

	const { minEtaMinutes, maxEtaMinutes } = SETTINGS_LIMITS;
	if (
		!Number.isInteger(input.etaMinutes) ||
		input.etaMinutes < minEtaMinutes ||
		input.etaMinutes > maxEtaMinutes
	) {
		throw invalid('etaMinutes');
	}

	const amounts = [
		'minOrderPaise',
		'deliveryFeePaise',
		'freeDeliveryAbovePaise',
		'smallCartFeePaise',
		'smallCartBelowPaise'
	] as const;
	for (const field of amounts) {
		if (!isAmount(input[field])) throw invalid(field);
	}

	let deliveryAreas: string[];
	try {
		deliveryAreas = validateDeliveryAreas(input.deliveryAreas);
	} catch {
		throw invalid('deliveryAreas');
	}

	let storePhone = blankToUndefined(input.storePhone);
	if (storePhone !== undefined) {
		const normalized = normalizeIndianPhone(storePhone);
		if (!normalized) throw invalid('storePhone');
		storePhone = normalized;
	}

	const upiVpa = blankToUndefined(input.upiVpa)?.toLowerCase();
	if (upiVpa !== undefined && !UPI_VPA.test(upiVpa)) throw invalid('upiVpa');

	return {
		opensAtMinute: input.opensAtMinute,
		closesAtMinute: input.closesAtMinute,
		etaMinutes: input.etaMinutes,
		deliveryAreas,
		minOrderPaise: input.minOrderPaise,
		deliveryFeePaise: input.deliveryFeePaise,
		freeDeliveryAbovePaise: input.freeDeliveryAbovePaise,
		smallCartFeePaise: input.smallCartFeePaise,
		smallCartBelowPaise: input.smallCartBelowPaise,
		storePhone,
		upiVpa
	};
}
