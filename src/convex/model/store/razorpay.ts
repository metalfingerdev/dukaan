/**
 * Talking to Razorpay: the few calls UPI-at-the-door needs, and checking that a webhook really came
 * from Razorpay. Runs in Convex's default runtime (fetch and Web Crypto), so no "use node".
 * Docs: razorpay.com/docs/api/qr-codes and razorpay.com/docs/webhooks.
 */

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
