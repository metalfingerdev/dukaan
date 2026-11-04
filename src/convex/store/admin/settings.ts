/**
 * The store settings the admin edits in /admin/settings: the open/closed switch, opening hours,
 * delivery time, fees, minimum order, delivery areas, the store phone and the UPI id. Every
 * function calls `requireAppAdmin`. The invoice details (legal name, address, GSTIN, prefix) have
 * their own form and mutation; until the store's accountant confirms them they are placeholders.
 *
 * Both writes work before the `storeSettings` row exists: they create it from
 * STORE_SETTINGS_DEFAULTS, so a fresh deployment can be set up from the page without the seed.
 */
import { v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import { validateInvoiceDetails } from '../../model/store/invoice';
import { validateSettings } from '../../model/store/settings';
import { STORE_SETTINGS_DEFAULTS } from '../../model/store/storeProfile';

const settingsFields = {
	opensAtMinute: v.number(),
	closesAtMinute: v.number(),
	etaMinutes: v.number(),
	deliveryAreas: v.array(v.string()),
	minOrderPaise: v.number(),
	deliveryFeePaise: v.number(),
	freeDeliveryAbovePaise: v.number(),
	smallCartFeePaise: v.number(),
	smallCartBelowPaise: v.number(),
	storePhone: v.optional(v.string()),
	upiVpa: v.optional(v.string())
};

const adminSettings = v.object({ ...settingsFields, isOpen: v.boolean() });

type StoredSettings = Omit<Doc<'storeSettings'>, '_id' | '_creationTime'>;

const toAdminSettings = (settings: StoredSettings) => ({
	isOpen: settings.isOpen,
	opensAtMinute: settings.opensAtMinute,
	closesAtMinute: settings.closesAtMinute,
	etaMinutes: settings.etaMinutes,
	deliveryAreas: settings.deliveryAreas,
	minOrderPaise: settings.minOrderPaise,
	deliveryFeePaise: settings.deliveryFeePaise,
	freeDeliveryAbovePaise: settings.freeDeliveryAbovePaise,
	smallCartFeePaise: settings.smallCartFeePaise,
	smallCartBelowPaise: settings.smallCartBelowPaise,
	...(settings.storePhone !== undefined ? { storePhone: settings.storePhone } : {}),
	...(settings.upiVpa !== undefined ? { upiVpa: settings.upiVpa } : {})
});

const findSettings = (ctx: MutationCtx) => ctx.db.query('storeSettings').first();

/** The current settings, or the defaults with `saved: false` when the row doesn't exist yet */
export const getSettings = query({
	args: {},
	returns: v.object({ settings: adminSettings, saved: v.boolean() }),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const row = await ctx.db.query('storeSettings').first();
		const settings: StoredSettings = row ?? STORE_SETTINGS_DEFAULTS;
		return { settings: toAdminSettings(settings), saved: row !== null };
	}
});

/**
 * Saves the settings form and returns what was stored (the phone normalised, the UPI id in lower
 * case), or throws `ConvexError({ code: 'INVALID_SETTINGS', field })`. Leaves the open/closed
 * switch alone, so saving a form opened earlier can't undo a switch made since. A missing or blank
 * phone or UPI id removes it.
 */
export const updateSettings = mutation({
	args: settingsFields,
	returns: adminSettings,
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const clean = validateSettings(args);
		const row = await findSettings(ctx);
		if (row) {
			// `undefined` removes a field in a patch, which is how a cleared phone or UPI id goes away
			await ctx.db.patch(row._id, clean);
			return toAdminSettings({ ...row, ...clean });
		}
		const { storePhone, upiVpa, ...rest } = clean;
		const created: StoredSettings = {
			...STORE_SETTINGS_DEFAULTS,
			...rest,
			...(storePhone !== undefined ? { storePhone } : {}),
			...(upiVpa !== undefined ? { upiVpa } : {})
		};
		await ctx.db.insert('storeSettings', created);
		return toAdminSettings(created);
	}
});

/** The manual open/closed switch, for "we're closing early" or a holiday */
export const setStoreOpen = mutation({
	args: { isOpen: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const row = await findSettings(ctx);
		if (row) await ctx.db.patch(row._id, { isOpen: args.isOpen });
		else await ctx.db.insert('storeSettings', { ...STORE_SETTINGS_DEFAULTS, isOpen: args.isOpen });
		return null;
	}
});

const invoiceDetails = v.object({
	legalName: v.string(),
	addressLine: v.string(),
	gstin: v.optional(v.string()),
	invoicePrefix: v.string()
});

/** What new invoices will carry. Invoices already issued keep the details they were issued with. */
export const getInvoiceDetails = query({
	args: {},
	returns: invoiceDetails,
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const row: StoredSettings = (await ctx.db.query('storeSettings').first()) ?? STORE_SETTINGS_DEFAULTS;
		return {
			legalName: row.legalName,
			addressLine: row.addressLine,
			invoicePrefix: row.invoicePrefix,
			...(row.gstin ? { gstin: row.gstin } : {})
		};
	}
});

/**
 * Saves the invoice details, or throws `INVALID_INVOICE_DETAILS` with the field. A blank GSTIN
 * removes it, and invoices then have no tax breakdown.
 */
export const updateInvoiceDetails = mutation({
	args: invoiceDetails.fields,
	returns: invoiceDetails,
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const clean = validateInvoiceDetails(args);
		const row = await findSettings(ctx);
		const fields = { ...clean, gstin: clean.gstin };
		if (row) await ctx.db.patch(row._id, fields);
		else await ctx.db.insert('storeSettings', { ...STORE_SETTINGS_DEFAULTS, ...clean });
		return clean;
	}
});
