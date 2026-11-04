/**
 * Delivery partners and cash settlement, for /admin/delivery. Every function calls
 * `requireAppAdmin`. A partner is matched to a signed-in user by their verified phone number
 * (model/store/access.ts), so adding one is typing a name and a number. Partners are switched off,
 * never deleted, because old orders point at them.
 *
 * Cash: a delivered order has `cashCollectedPaise` once the partner confirms collection (the
 * delivery screens). Settling hands the day's cash from one partner to the store; the admin sends
 * the total they saw, and the mutation refuses if it has changed since, so what is on screen is
 * always what gets settled.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../../_generated/dataModel';
import type { QueryCtx } from '../../_generated/server';
import { mutation, query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import { istDayStartMs } from '../../model/store/time';
import { isValidIndianMobile, normalizeIndianMobile } from '../../otp/phone';

export const MAX_PARTNERS = 50;
const MAX_NAME_LENGTH = 60;
/** Newest delivered orders looked at per partner; a day's runs are far fewer than this */
const SETTLEMENT_WINDOW = 200;

const partnerView = v.object({
	_id: v.id('deliveryPartners'),
	name: v.string(),
	phoneNumber: v.string(),
	isActive: v.boolean()
});

const toPartnerView = (partner: Doc<'deliveryPartners'>) => ({
	_id: partner._id,
	name: partner.name,
	phoneNumber: partner.phoneNumber,
	isActive: partner.isActive
});

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

/** Every partner, active first. Bounded by MAX_PARTNERS. */
export const listPartners = query({
	args: {},
	returns: v.array(partnerView),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const partners = await ctx.db.query('deliveryPartners').take(MAX_PARTNERS + 1);
		return partners
			.map(toPartnerView)
			.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
	}
});

/** Adds a partner, or throws `INVALID_NAME`, `INVALID_PHONE`, `PHONE_TAKEN` or `TOO_MANY_PARTNERS` */
export const addPartner = mutation({
	args: { name: v.string(), phoneNumber: v.string() },
	returns: v.id('deliveryPartners'),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const name = cleanName(args.name);
		if (name.length === 0 || name.length > MAX_NAME_LENGTH) throw new ConvexError({ code: 'INVALID_NAME' });
		const phoneNumber = normalizeIndianMobile(args.phoneNumber);
		if (!phoneNumber || !isValidIndianMobile(phoneNumber)) throw new ConvexError({ code: 'INVALID_PHONE' });
		const taken = await ctx.db
			.query('deliveryPartners')
			.withIndex('by_phoneNumber', (q) => q.eq('phoneNumber', phoneNumber))
			.first();
		if (taken) throw new ConvexError({ code: 'PHONE_TAKEN' });
		const existing = await ctx.db.query('deliveryPartners').take(MAX_PARTNERS);
		if (existing.length >= MAX_PARTNERS) throw new ConvexError({ code: 'TOO_MANY_PARTNERS' });
		return await ctx.db.insert('deliveryPartners', { name, phoneNumber, isActive: true });
	}
});

/** Switches a partner on or off. Off means they can't open the delivery screens or be assigned. */
export const setPartnerActive = mutation({
	args: { partnerId: v.id('deliveryPartners'), isActive: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const partner = await ctx.db.get(args.partnerId);
		if (!partner) throw new ConvexError({ code: 'PARTNER_NOT_FOUND' });
		await ctx.db.patch(partner._id, { isActive: args.isActive });
		return null;
	}
});

/** The partner's delivered orders still holding cash the store hasn't received, newest first */
const unsettledCashOrders = async (ctx: Pick<QueryCtx, 'db'>, partnerId: Id<'deliveryPartners'>) => {
	const delivered = await ctx.db
		.query('orders')
		.withIndex('by_assignedPartnerId_and_status', (q) =>
			q.eq('assignedPartnerId', partnerId).eq('status', 'delivered')
		)
		.order('desc')
		.take(SETTLEMENT_WINDOW);
	return delivered.filter(
		(order) =>
			order.cashSettledAt === undefined &&
			order.deliveredAt !== undefined &&
			(order.cashCollectedPaise ?? 0) > 0
	);
};

const dayTotals = (orders: Doc<'orders'>[]) => {
	const days = new Map<number, { dayStartMs: number; orderCount: number; totalPaise: number }>();
	for (const order of orders) {
		const dayStartMs = istDayStartMs(order.deliveredAt!);
		const day = days.get(dayStartMs) ?? { dayStartMs, orderCount: 0, totalPaise: 0 };
		day.orderCount += 1;
		day.totalPaise += order.cashCollectedPaise ?? 0;
		days.set(dayStartMs, day);
	}
	return [...days.values()].sort((a, b) => b.dayStartMs - a.dayStartMs);
};

/** For each partner holding cash: how much, per delivery day (India time), newest day first */
export const cashToSettle = query({
	args: {},
	returns: v.array(
		v.object({
			partner: partnerView,
			days: v.array(v.object({ dayStartMs: v.number(), orderCount: v.number(), totalPaise: v.number() }))
		})
	),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const partners = await ctx.db.query('deliveryPartners').take(MAX_PARTNERS);
		const rows = await Promise.all(
			partners.map(async (partner) => ({
				partner: toPartnerView(partner),
				days: dayTotals(await unsettledCashOrders(ctx, partner._id))
			}))
		);
		return rows.filter((row) => row.days.length > 0);
	}
});

/**
 * Marks one partner's cash for one delivery day as received. `expectedTotalPaise` is the total the
 * admin saw; if it has changed the mutation throws `CASH_CHANGED` with the new total and settles
 * nothing. Settling twice finds nothing left and throws `NOTHING_TO_SETTLE`.
 */
export const settleCash = mutation({
	args: { partnerId: v.id('deliveryPartners'), dayStartMs: v.number(), expectedTotalPaise: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireAppAdmin(ctx);
		const orders = (await unsettledCashOrders(ctx, args.partnerId)).filter(
			(order) => istDayStartMs(order.deliveredAt!) === args.dayStartMs
		);
		if (orders.length === 0) throw new ConvexError({ code: 'NOTHING_TO_SETTLE' });
		const totalPaise = orders.reduce((sum, order) => sum + (order.cashCollectedPaise ?? 0), 0);
		if (totalPaise !== args.expectedTotalPaise) throw new ConvexError({ code: 'CASH_CHANGED', totalPaise });
		const now = Date.now();
		for (const order of orders) await ctx.db.patch(order._id, { cashSettledAt: now });
		return null;
	}
});
