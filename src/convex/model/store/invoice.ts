/**
 * Invoices. A number is given only when an order is delivered, inside the same transaction (so a
 * cancelled order never uses one and the sequence has no gaps), from the `invoice:<financial year>`
 * counter. Format `<prefix>/<financial year>/<6-digit sequence>`, for example `DK/26-27/000123`,
 * at most 16 characters. The seller's details are copied onto the order when the invoice is
 * issued, so later changes in /admin/settings never rewrite an old invoice.
 *
 * Tax: retail prices are tax-inclusive, so tax is taken out of the price, never added on top. The
 * breakdown is shown only when the store has a GSTIN. Which items are taxed, at what rate, and the
 * exact wording are the store's accountant's decisions; this code makes no claim about them.
 * See .agents/skills/store-app/references/admin.md, "Invoices".
 */
import { ConvexError } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { nextCounterValue } from './counters';
import { STORE_SETTINGS_DEFAULTS } from './storeProfile';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const MAX_INVOICE_NUMBER_LENGTH = 16;

/** The Indian financial year (1 April to 31 March, IST) of a moment: `'26-27'` for 15 Nov 2026 */
export function financialYear(ms: number) {
	const ist = new Date(ms + IST_OFFSET_MS);
	const year = ist.getUTCFullYear();
	const start = ist.getUTCMonth() >= 3 ? year : year - 1; // month 3 is April
	const two = (n: number) => String(n % 100).padStart(2, '0');
	return `${two(start)}-${two(start + 1)}`;
}

export const formatInvoiceNumber = (prefix: string, year: string, sequence: number) =>
	`${prefix}/${year}/${String(sequence).padStart(6, '0')}`;

// ---- the store's invoice details, edited in /admin/settings ----

// The shape of a GSTIN: state code, PAN, entity number, "Z", check character. Shape only; whether
// a GSTIN is real is for the GST portal, not this code.
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PREFIX = /^[A-Z]{1,3}$/;

export type InvoiceDetails = { legalName: string; addressLine: string; gstin?: string; invoicePrefix: string };

const invalid = (field: keyof InvoiceDetails) => new ConvexError({ code: 'INVALID_INVOICE_DETAILS', field });

/** Cleans what the admin typed, or throws `INVALID_INVOICE_DETAILS` naming the field */
export function validateInvoiceDetails(input: InvoiceDetails): InvoiceDetails {
	const text = (value: string) => value.trim().replace(/\s+/g, ' ');
	const legalName = text(input.legalName);
	if (legalName.length === 0 || legalName.length > 100) throw invalid('legalName');
	const addressLine = text(input.addressLine);
	if (addressLine.length === 0 || addressLine.length > 200) throw invalid('addressLine');
	const invoicePrefix = input.invoicePrefix.trim().toUpperCase();
	if (!PREFIX.test(invoicePrefix)) throw invalid('invoicePrefix');
	const gstin = input.gstin?.replace(/\s/g, '').toUpperCase() || undefined;
	if (gstin !== undefined && !GSTIN.test(gstin)) throw invalid('gstin');
	return { legalName, addressLine, invoicePrefix, ...(gstin ? { gstin } : {}) };
}

// ---- issuing ----

/**
 * Gives a delivered order its invoice number and a copy of the seller's details. Call it from the
 * transaction that marks the order delivered (`transitionOrder`). Does nothing if the order already
 * has one, so it can never be renumbered.
 */
export async function issueInvoice(ctx: MutationCtx, order: Doc<'orders'>, issuedAt: number) {
	if (order.invoiceNumber) return;
	const settings: Pick<Doc<'storeSettings'>, 'legalName' | 'addressLine' | 'gstin' | 'invoicePrefix'> =
		(await ctx.db.query('storeSettings').first()) ?? STORE_SETTINGS_DEFAULTS;
	const year = financialYear(issuedAt);
	const sequence = await nextCounterValue(ctx, `invoice:${year}`);
	const invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, year, sequence);
	await ctx.db.patch(order._id, {
		invoiceNumber,
		invoiceIssuedAt: issuedAt,
		invoiceSeller: {
			legalName: settings.legalName,
			addressLine: settings.addressLine,
			...(settings.gstin ? { gstin: settings.gstin } : {})
		}
	});
}

// ---- reading ----

type TaxLine = { gstRatePercent?: number; amountPaise: number };

/**
 * The tax inside a tax-inclusive amount, split into the central and state halves. For amount A at
 * rate r%, tax = round(A × r / (100 + r)) and the taxable value is A − tax, so the parts always add
 * up to exactly what the customer paid.
 */
export function splitInclusiveTax(line: TaxLine) {
	if (!line.gstRatePercent) return null;
	const tax = Math.round((line.amountPaise * line.gstRatePercent) / (100 + line.gstRatePercent));
	const cgstPaise = Math.floor(tax / 2);
	return { taxablePaise: line.amountPaise - tax, cgstPaise, sgstPaise: tax - cgstPaise };
}

const MAX_LINES = 100;

/**
 * Everything the printable invoice shows, from the order's own snapshot (names, prices and rates
 * as they were when ordered; seller details as they were when issued). `null` before delivery.
 */
export async function invoiceFor(ctx: Pick<QueryCtx, 'db'>, order: Doc<'orders'>) {
	if (!order.invoiceNumber || !order.invoiceSeller || order.invoiceIssuedAt === undefined) return null;
	const items = await ctx.db
		.query('orderItems')
		.withIndex('by_orderId', (q) => q.eq('orderId', order._id))
		.take(MAX_LINES);
	const withTax = order.invoiceSeller.gstin !== undefined;
	const lines = items.map((item) => {
		const amountPaise = item.unitPricePaise * item.quantity;
		const tax = withTax ? splitInclusiveTax({ gstRatePercent: item.gstRatePercent, amountPaise }) : null;
		return {
			name: item.name,
			unitLabel: item.unitLabel,
			quantity: item.quantity,
			ratePaise: item.unitPricePaise,
			amountPaise,
			...(withTax && item.hsn ? { hsn: item.hsn } : {}),
			...(withTax && item.gstRatePercent ? { gstRatePercent: item.gstRatePercent } : {}),
			...(tax ?? {})
		};
	});
	const taxTotals = withTax
		? lines.reduce(
				(sum, line) => ({
					taxablePaise: sum.taxablePaise + (line.taxablePaise ?? line.amountPaise),
					cgstPaise: sum.cgstPaise + (line.cgstPaise ?? 0),
					sgstPaise: sum.sgstPaise + (line.sgstPaise ?? 0)
				}),
				{ taxablePaise: 0, cgstPaise: 0, sgstPaise: 0 }
			)
		: undefined;
	return {
		invoiceNumber: order.invoiceNumber,
		issuedAt: order.invoiceIssuedAt,
		orderNumber: order.orderNumber,
		seller: order.invoiceSeller,
		buyer: {
			name: order.address.contactName,
			line1: order.address.line1,
			area: order.address.area,
			...(order.address.landmark ? { landmark: order.address.landmark } : {})
		},
		paymentMethod: order.paymentMethod,
		...(order.paidWith ? { paidWith: order.paidWith } : {}),
		lines,
		subtotalPaise: order.subtotalPaise,
		deliveryFeePaise: order.deliveryFeePaise,
		smallCartFeePaise: order.smallCartFeePaise,
		savingsPaise: order.savingsPaise,
		totalPaise: order.totalPaise,
		...(taxTotals ? { taxTotals } : {})
	};
}
