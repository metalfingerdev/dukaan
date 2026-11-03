/**
 * Facts about this store, in one place so the seed, the storefront and (later) checkout agree.
 * Every value marked TODO (dictate) is a placeholder the store hasn't decided yet; change it here
 * and re-run the seed on a fresh deployment, or change them in /admin/settings. The decided
 * facts and the open questions are in .agents/skills/store-app/references/store-profile.md.
 *
 * Lives under src/convex because the seed imports it; the frontend imports Convex files through
 * `#convex/...`, never the other way round. Money is integer paise.
 */
import { AUTH_CONSTANTS } from '../../auth.constants';

/** The name customers see: header, page titles, later invoices and SMS */
export const STORE_NAME = (AUTH_CONSTANTS.brandName ?? 'Dukaan').trim();

const rupees = (amount: number) => amount * 100;

/** Delivery time slots: decided by the store, so plain constants rather than settings */
export const SLOT_MINUTES = 60;
export const SLOT_NOTICE_MINUTES = 30;

/** Values for the single `storeSettings` row the seed creates. Placeholders unless noted. */
export const STORE_SETTINGS_DEFAULTS = {
	storeName: STORE_NAME,
	isOpen: true,
	opensAtMinute: 9 * 60, // TODO (dictate): 09:00 IST
	closesAtMinute: 21 * 60, // TODO (dictate): 21:00 IST
	etaMinutes: 30, // TODO (dictate)
	// TODO (dictate): the real localities, colleges and hostels. These are placeholders so checkout
	// can be tried; the admin sets the real list in /admin/settings
	deliveryAreas: ['Main Market (placeholder)', 'College campus (placeholder)', 'Hostels (placeholder)'],
	minOrderPaise: rupees(99), // TODO (dictate)
	deliveryFeePaise: rupees(20), // TODO (dictate)
	freeDeliveryAbovePaise: rupees(299), // TODO (dictate)
	smallCartFeePaise: rupees(10), // TODO (dictate)
	smallCartBelowPaise: rupees(99), // TODO (dictate)
	// Invoice details. No GSTIN until the store confirms its registration with its accountant
	legalName: STORE_NAME, // TODO (dictate)
	addressLine: 'Kothri Kalan, Madhya Pradesh', // TODO (dictate): full address
	invoicePrefix: 'DK' // proposed, up to 3 letters
};
