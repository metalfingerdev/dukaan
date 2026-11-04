/**
 * Payments taken through Razorpay, for the admin to match against Razorpay's dashboard and the
 * bank: online payments at checkout and UPI QR payments at the door, newest first, with any refund.
 * Every function calls `requireAppAdmin`. Cash is settled with the riders in /admin/delivery.
 */
import { v } from 'convex/values';
import { query } from '../../_generated/server';
import { requireAppAdmin } from '../../model/store/access';
import { orderStatus, refundState } from '../validators';

const LIST_SIZE = 50;

export const listGatewayPayments = query({
	args: {},
	returns: v.array(
		v.object({
			orderId: v.id('orders'),
			orderNumber: v.number(),
			orderStatus,
			kind: v.union(v.literal('online'), v.literal('upi_qr')),
			amountPaise: v.number(),
			paymentId: v.optional(v.string()),
			paidAt: v.optional(v.number()),
			refund: v.optional(refundState)
		})
	),
	handler: async (ctx) => {
		await requireAppAdmin(ctx);
		const [online, qr] = await Promise.all([
			ctx.db
				.query('onlinePayments')
				.withIndex('by_status', (q) => q.eq('status', 'paid'))
				.order('desc')
				.take(LIST_SIZE),
			ctx.db
				.query('upiQrs')
				.withIndex('by_status', (q) => q.eq('status', 'paid'))
				.order('desc')
				.take(LIST_SIZE)
		]);
		const rows = [
			...online.map((payment) => ({ ...payment, kind: 'online' as const })),
			...qr.map((payment) => ({ ...payment, kind: 'upi_qr' as const }))
		]
			.sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))
			.slice(0, LIST_SIZE);
		const withOrders = await Promise.all(
			rows.map(async (row) => {
				const order = await ctx.db.get(row.orderId);
				return order
					? [
							{
								orderId: order._id,
								orderNumber: order.orderNumber,
								orderStatus: order.status,
								kind: row.kind,
								amountPaise: row.amountPaise,
								paymentId: row.paymentId,
								paidAt: row.paidAt,
								refund: order.refund
							}
						]
					: [];
			})
		);
		return withOrders.flat();
	}
});
