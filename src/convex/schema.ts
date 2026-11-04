import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
	deliveryAddress,
	orderActorKind,
	orderStatus,
	paymentMethod,
	paymentStatus,
	stockAdjustmentReason
} from './store/validators';

export const otpChannelId = v.union(
	v.literal('textbee'),
	v.literal('whatsapp'),
	v.literal('fast2sms'),
	v.literal('console')
);

export const otpDeliveryStatus = v.union(
	v.literal('sent'), // the provider accepted it (not proof of delivery)
	v.literal('failed'),
	v.literal('rate_limited')
);

const schema = defineSchema({
	// See convex/otp/deliveries.ts
	otpDeliveries: defineTable({
		phoneNumber: v.string(), // E.164
		channel: v.optional(otpChannelId), // unset when rate limited before any channel was tried
		status: otpDeliveryStatus,
		providerMessageId: v.optional(v.string()),
		error: v.optional(v.string())
	}).index('by_phoneNumber', ['phoneNumber']),

	/* ---------------------------------------------------------------------------------------- */
	/* Store. See .agents/skills/store-app/references/data-model.md. Money fields are integer   */
	/* paise; user ids are Better Auth ids (strings), since users live in the betterAuth        */
	/* component.                                                                               */
	/* ---------------------------------------------------------------------------------------- */

	categories: defineTable({
		name: v.string(),
		slug: v.string(),
		imageId: v.optional(v.id('_storage')),
		sortOrder: v.number(),
		isActive: v.boolean()
	})
		.index('by_slug', ['slug'])
		.index('by_isActive_and_sortOrder', ['isActive', 'sortOrder']),

	products: defineTable({
		categoryId: v.id('categories'),
		name: v.string(),
		slug: v.string(),
		unitLabel: v.string(), // "1 kg", "500 ml", "6 pcs"
		pricePaise: v.number(), // selling price, tax-inclusive
		mrpPaise: v.number(), // printed MRP, >= pricePaise
		stock: v.number(), // whole units on the shelf; only adjustStock changes it
		lowStockAt: v.optional(v.number()),
		maxPerOrder: v.number(),
		isActive: v.boolean(), // false hides it from customers
		isFeatured: v.boolean(),
		imageId: v.optional(v.id('_storage')),
		gstRatePercent: v.optional(v.number()), // only used when the store has a GSTIN
		hsn: v.optional(v.string())
	})
		.index('by_slug', ['slug'])
		.index('by_categoryId_and_isActive', ['categoryId', 'isActive'])
		.index('by_isFeatured_and_isActive', ['isFeatured', 'isActive'])
		.index('by_stock', ['stock'])
		.searchIndex('search_name', { searchField: 'name', filterFields: ['isActive', 'categoryId'] }),

	// A signed-in customer's cart; guests keep theirs in localStorage
	cartItems: defineTable({
		userId: v.string(),
		productId: v.id('products'),
		quantity: v.number()
	}).index('by_userId_and_productId', ['userId', 'productId']),

	addresses: defineTable({
		userId: v.string(),
		label: v.string(), // "Home", "Hostel", "Shop"
		...deliveryAddress.fields,
		isDefault: v.boolean()
	}).index('by_userId', ['userId']),

	orders: defineTable({
		orderNumber: v.number(), // short and human-friendly, from the `order` counter
		userId: v.string(),
		idempotencyKey: v.string(), // one per checkout attempt; makes placeOrder safe to retry
		status: orderStatus,
		paymentMethod,
		paymentStatus,
		subtotalPaise: v.number(),
		savingsPaise: v.number(),
		deliveryFeePaise: v.number(),
		smallCartFeePaise: v.number(),
		totalPaise: v.number(),
		address: deliveryAddress, // snapshot; later edits to the saved address don't change it
		slotStartMs: v.optional(v.number()), // unset means "as soon as possible"
		customerNote: v.optional(v.string()),
		deliveryCode: v.string(), // 4 digits; shown to the customer, typed by the partner
		assignedPartnerId: v.optional(v.id('deliveryPartners')),
		deliveredAt: v.optional(v.number()),
		invoiceNumber: v.optional(v.string()),
		paidWith: v.optional(v.union(v.literal('cash'), v.literal('upi'))), // how the partner was actually paid
		cashCollectedPaise: v.optional(v.number()), // set only when paid in cash
		cashSettledAt: v.optional(v.number()) // the admin received this cash from the partner
	})
		.index('by_userId', ['userId'])
		.index('by_userId_and_idempotencyKey', ['userId', 'idempotencyKey'])
		.index('by_orderNumber', ['orderNumber'])
		.index('by_status', ['status'])
		.index('by_assignedPartnerId_and_status', ['assignedPartnerId', 'status']),

	orderItems: defineTable({
		orderId: v.id('orders'),
		productId: v.id('products'),
		// Snapshots: later edits to the product must not change this order or its invoice
		name: v.string(),
		unitLabel: v.string(),
		unitPricePaise: v.number(),
		mrpPaise: v.number(),
		quantity: v.number(),
		gstRatePercent: v.optional(v.number()),
		hsn: v.optional(v.string())
	}).index('by_orderId', ['orderId']),

	// The status timeline customers see and the admin audits
	orderEvents: defineTable({
		orderId: v.id('orders'),
		status: orderStatus,
		actorKind: orderActorKind,
		actorId: v.optional(v.string()),
		note: v.optional(v.string())
	}).index('by_orderId', ['orderId']),

	stockAdjustments: defineTable({
		productId: v.id('products'),
		delta: v.number(), // negative for sales and write-offs
		stockAfter: v.number(),
		reason: stockAdjustmentReason,
		orderId: v.optional(v.id('orders')),
		actorId: v.optional(v.string())
	}).index('by_productId', ['productId']),

	// Matched against the signed-in user's verified phone number (model/store/access.ts)
	deliveryPartners: defineTable({
		name: v.string(),
		phoneNumber: v.string(), // E.164
		isActive: v.boolean()
	}).index('by_phoneNumber', ['phoneNumber']),

	// Exactly one document
	storeSettings: defineTable({
		storeName: v.string(),
		isOpen: v.boolean(), // the manual open/closed switch
		opensAtMinute: v.number(), // minutes after midnight IST
		closesAtMinute: v.number(),
		etaMinutes: v.number(),
		deliveryAreas: v.array(v.string()), // a short, bounded list
		minOrderPaise: v.number(),
		deliveryFeePaise: v.number(),
		freeDeliveryAbovePaise: v.number(),
		smallCartFeePaise: v.number(),
		smallCartBelowPaise: v.number(),
		storePhone: v.optional(v.string()),
		upiVpa: v.optional(v.string()),
		// Invoice details; no GSTIN means no tax breakdown on invoices
		legalName: v.string(),
		addressLine: v.string(),
		gstin: v.optional(v.string()),
		invoicePrefix: v.string()
	}),

	// Sequences: `order`, and `invoice:<financial year>` such as `invoice:26-27`
	counters: defineTable({
		key: v.string(),
		value: v.number()
	}).index('by_key', ['key'])
});

export default schema;
