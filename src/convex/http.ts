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
 * checks out. A captured payment to one of our UPI QRs marks the order paid (store/upi.ts).
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
				payment?: { entity?: { id?: unknown; amount?: unknown; status?: unknown } };
				qr_code?: { entity?: { id?: unknown } };
			};
		};
		const payment = payload?.payment?.entity;
		const qrId = payload?.qr_code?.entity?.id;
		if (
			name === 'qr_code.credited' &&
			typeof qrId === 'string' &&
			typeof payment?.id === 'string' &&
			typeof payment.amount === 'number' &&
			payment.status === 'captured'
		) {
			await ctx.runMutation(internal.store.upi.recordPayment, {
				qrId,
				paymentId: payment.id,
				amountPaise: payment.amount
			});
		}
		return new Response(null, { status: 200 });
	})
});

export default http;
