import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { env, httpAction } from './_generated/server';
import { authComponent, createAuth } from './auth';
import { resend } from './email';
import { isRazorpaySignatureValid } from './model/store/razorpay';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
	path: '/resend-webhook',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		return await resend.handleResendEventWebhook(ctx, req);
	})
});

/**
 * Razorpay's webhook. Anyone can POST here, so the body is trusted only after its HMAC signature
 * checks out. A captured payment to one of our UPI QRs (store/upi.ts) or Razorpay orders
 * (store/payments.ts) marks the order paid; refund events update the order's refund.
 * Answers 200 to every verified event, including ones we don't use, so Razorpay stops resending.
 */
http.route({
	path: '/razorpay-webhook',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		const secret = env.RAZORPAY_WEBHOOK_SECRET;
		if (!secret) return new Response('webhook secret not set', { status: 503 });
		const body = await req.text();
		const signature = req.headers.get('x-razorpay-signature') ?? '';
		if (!(await isRazorpaySignatureValid(body, signature, secret))) {
			return new Response('bad signature', { status: 401 });
		}

		let event: unknown;
		try {
			event = JSON.parse(body);
		} catch {
			return new Response('bad body', { status: 400 });
		}
		const { event: name, payload } = (event ?? {}) as {
			event?: unknown;
			payload?: {
				payment?: { entity?: { id?: unknown; amount?: unknown; status?: unknown; order_id?: unknown } };
				qr_code?: { entity?: { id?: unknown } };
				refund?: { entity?: { id?: unknown; status?: unknown } };
			};
		};
		const payment = payload?.payment?.entity;
		const captured =
			typeof payment?.id === 'string' && typeof payment.amount === 'number' && payment.status === 'captured'
				? { paymentId: payment.id, amountPaise: payment.amount }
				: null;

		// UPI QR at the door (store/upi.ts)
		const qrId = payload?.qr_code?.entity?.id;
		if (name === 'qr_code.credited' && captured && typeof qrId === 'string') {
			await ctx.runMutation(internal.store.upi.recordPayment, { qrId, ...captured });
		}
		// Paid online at checkout (store/payments.ts). Both events may arrive; the second changes nothing.
		if ((name === 'payment.captured' || name === 'order.paid') && captured && typeof payment?.order_id === 'string') {
			await ctx.runMutation(internal.store.payments.recordOnlinePayment, {
				razorpayOrderId: payment.order_id,
				...captured
			});
		}
		// A refund we asked for has finished
		const refund = payload?.refund?.entity;
		if ((name === 'refund.processed' || name === 'refund.failed') && typeof refund?.id === 'string') {
			await ctx.runMutation(internal.store.payments.recordRefundEvent, {
				refundId: refund.id,
				status: name === 'refund.processed' ? 'processed' : 'failed'
			});
		}
		return new Response(null, { status: 200 });
	})
});

export default http;
