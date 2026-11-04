/**
 * Talking to Razorpay: the few calls UPI-at-the-door needs, and checking that a webhook really came
 * from Razorpay. Runs in Convex's default runtime (fetch and Web Crypto), so no "use node".
 * Docs: razorpay.com/docs/api/qr-codes and razorpay.com/docs/webhooks.
 */

import { env } from '../../_generated/server';

const API = 'https://api.razorpay.com/v1';

/** How long a QR stays payable. Razorpay allows at most 2 hours for a single-use QR. */
export const QR_LIFETIME_MS = 115 * 60 * 1000;

export type RazorpayKeys = { keyId: string; keySecret: string };

export class RazorpayError extends Error {
	constructor(
		readonly status: number,
		readonly description: string
	) {
		super(`Razorpay ${status}: ${description}`);
	}
}

/** The API keys from the deployment's env vars; throws when they aren't set */
export const razorpayKeys = (): RazorpayKeys => {
	if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new RazorpayError(0, 'Razorpay keys are not set');
	return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
};

const call = async <T>(keys: RazorpayKeys, path: string, init: RequestInit = {}): Promise<T> => {
	const response = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Basic ${btoa(`${keys.keyId}:${keys.keySecret}`)}`,
			'Content-Type': 'application/json',
			...init.headers
		}
	});
	const body = (await response.json().catch(() => null)) as
		| (T & { error?: { description?: string } })
		| null;
	if (!response.ok || !body) {
		throw new RazorpayError(response.status, body?.error?.description ?? 'no response body');
	}
	return body;
};

export type RazorpayQr = { id: string; image_url: string; close_by: number; status: string };

/** A single-use UPI QR fixed to `amountPaise`, closing at `closeByMs` */
export const createUpiQr = (
	keys: RazorpayKeys,
	args: { amountPaise: number; closeByMs: number; name: string; description: string; notes: Record<string, string> }
) =>
	call<RazorpayQr>(keys, '/payments/qr_codes', {
		method: 'POST',
		body: JSON.stringify({
			type: 'upi_qr',
			name: args.name.slice(0, 40),
			usage: 'single_use',
			fixed_amount: true,
			payment_amount: args.amountPaise,
			description: args.description,
			close_by: Math.floor(args.closeByMs / 1000),
			notes: args.notes
		})
	});

/** A harmless read, to tell bad keys apart from a feature that isn't switched on */
export const checkKeys = (keys: RazorpayKeys) => call<{ count: number }>(keys, '/payments?count=1');

export type RazorpayPayment = { id: string; amount: number; status: string; method: string };

/** Payments made to one QR code, for when a webhook is late or lost */
export const listQrPayments = (keys: RazorpayKeys, qrId: string) =>
	call<{ items: RazorpayPayment[] }>(keys, `/payments/qr_codes/${encodeURIComponent(qrId)}/payments`);

export type RazorpayOrder = { id: string; amount: number; status: string };

/** A Razorpay order for one of ours: the customer pays it in Razorpay Checkout */
export const createRazorpayOrder = (
	keys: RazorpayKeys,
	args: { amountPaise: number; receipt: string; notes: Record<string, string> }
) =>
	call<RazorpayOrder>(keys, '/orders', {
		method: 'POST',
		body: JSON.stringify({
			amount: args.amountPaise,
			currency: 'INR',
			receipt: args.receipt.slice(0, 40),
			notes: args.notes
		})
	});

/** Payment attempts on a Razorpay order; at most one can be captured */
export const listOrderPayments = (keys: RazorpayKeys, razorpayOrderId: string) =>
	call<{ items: (RazorpayPayment & { order_id?: string })[] }>(
		keys,
		`/orders/${encodeURIComponent(razorpayOrderId)}/payments`
	);

export type RazorpayRefund = { id: string; status: 'pending' | 'processed' | 'failed'; amount: number };

/**
 * Refunds a whole payment. `receipt` is Razorpay's idempotency key for refunds: the same receipt
 * on the same payment is refused as a duplicate, so a retried call can never refund twice.
 */
export const refundPayment = (keys: RazorpayKeys, paymentId: string, receipt: string) =>
	call<RazorpayRefund>(keys, `/payments/${encodeURIComponent(paymentId)}/refund`, {
		method: 'POST',
		body: JSON.stringify({ receipt: receipt.slice(0, 40), speed: 'normal' })
	});

const toHex = (bytes: ArrayBuffer) =>
	[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Whether `signature` (the `X-Razorpay-Signature` header) is the HMAC-SHA256 of the raw request
 * body under the webhook secret. Anyone can POST to the webhook URL, so nothing in a request is
 * trusted until this passes. Compares in constant time.
 */
export async function isRazorpaySignatureValid(rawBody: string, signature: string, secret: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const expected = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
	if (expected.length !== signature.length) return false;
	let difference = 0;
	for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	return difference === 0;
}
