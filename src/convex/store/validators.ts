/**
 * Validators shared by the store schema and store functions, so arguments and tables can't drift.
 * See .agents/skills/store-app/references/data-model.md. Money fields are integer paise.
 */
import { v } from 'convex/values';

export const orderStatus = v.union(
	v.literal('placed'),
	v.literal('accepted'),
	v.literal('packed'),
	v.literal('out_for_delivery'),
	v.literal('delivered'),
	v.literal('delivery_failed'), // the partner couldn't deliver; the admin decides what happens next
	v.literal('cancelled')
);

// Both are collected at the door until an online payment gateway is added
export const paymentMethod = v.union(v.literal('cod'), v.literal('upi_on_delivery'));

export const paymentStatus = v.union(
	v.literal('pending'),
	v.literal('paid'),
	v.literal('refunded')
);

export const addressKind = v.union(v.literal('house'), v.literal('hostel'), v.literal('shop'));

/** The address fields used for delivery; orders keep a snapshot of them */
export const deliveryAddress = v.object({
	kind: addressKind,
	line1: v.string(), // house no. / hostel and room / shop name
	area: v.string(), // one of storeSettings.deliveryAreas
	landmark: v.optional(v.string()),
	contactName: v.string(),
	contactPhone: v.string(), // E.164
	lat: v.optional(v.number()),
	lng: v.optional(v.number()),
	mapsUrl: v.optional(v.string()) // a shared Google Maps link; see isAllowedMapsUrl
});

export const orderActorKind = v.union(
	v.literal('customer'),
	v.literal('admin'),
	v.literal('partner'),
	v.literal('system')
);

export const stockAdjustmentReason = v.union(
	v.literal('received'),
	v.literal('sold'),
	v.literal('order_cancelled'),
	v.literal('damaged'),
	v.literal('correction')
);

/** The seller's details as copied onto an order when its invoice is issued */
export const invoiceSeller = v.object({
	legalName: v.string(),
	addressLine: v.string(),
	gstin: v.optional(v.string())
});

/** What the printable invoice shows (model/store/invoice.ts `invoiceFor`) */
export const invoiceView = v.object({
	invoiceNumber: v.string(),
	issuedAt: v.number(),
	orderNumber: v.number(),
	seller: invoiceSeller,
	buyer: v.object({ name: v.string(), line1: v.string(), area: v.string(), landmark: v.optional(v.string()) }),
	paymentMethod,
	paidWith: v.optional(v.union(v.literal('cash'), v.literal('upi'))),
	lines: v.array(
		v.object({
			name: v.string(),
			unitLabel: v.string(),
			quantity: v.number(),
			ratePaise: v.number(),
			amountPaise: v.number(),
			hsn: v.optional(v.string()),
			gstRatePercent: v.optional(v.number()),
			taxablePaise: v.optional(v.number()),
			cgstPaise: v.optional(v.number()),
			sgstPaise: v.optional(v.number())
		})
	),
	subtotalPaise: v.number(),
	deliveryFeePaise: v.number(),
	smallCartFeePaise: v.number(),
	savingsPaise: v.number(),
	totalPaise: v.number(),
	taxTotals: v.optional(v.object({ taxablePaise: v.number(), cgstPaise: v.number(), sgstPaise: v.number() }))
});
