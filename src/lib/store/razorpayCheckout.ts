/**
 * Razorpay Checkout in the browser: loads Razorpay's script on demand and opens the payment window
 * for one Razorpay order. What it reports back is only a prompt to ask the server to check with
 * Razorpay; the server never takes the browser's word that a payment went through.
 */
type CheckoutOptions = {
	key: string;
	order_id: string;
	amount: number;
	currency: 'INR';
	name: string;
	description: string;
	prefill?: { name?: string; contact?: string };
	theme?: { color?: string };
	handler: () => void;
	modal?: { ondismiss?: () => void };
};
type RazorpayInstance = { open(): void; on(event: 'payment.failed', handler: () => void): void };

declare global {
	interface Window {
		Razorpay?: new (options: CheckoutOptions) => RazorpayInstance;
	}
}

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let loading: Promise<boolean> | null = null;

const loadScript = () => {
	if (window.Razorpay) return Promise.resolve(true);
	loading ??= new Promise<boolean>((resolve) => {
		const script = document.createElement('script');
		script.src = SCRIPT;
		script.async = true;
		script.onload = () => resolve(Boolean(window.Razorpay));
		script.onerror = () => {
			loading = null; // let a later tap try again
			resolve(false);
		};
		document.head.appendChild(script);
	});
	return loading;
};

export type CheckoutResult = 'completed' | 'dismissed' | 'failed' | 'unavailable';

/** Opens the payment window and settles once the customer finishes, fails or closes it */
export async function openRazorpayCheckout(
	options: Omit<CheckoutOptions, 'handler' | 'modal' | 'currency'>
): Promise<CheckoutResult> {
	if (!(await loadScript()) || !window.Razorpay) return 'unavailable';
	const Razorpay = window.Razorpay;
	return new Promise((resolve) => {
		let failed = false;
		const checkout = new Razorpay({
			...options,
			currency: 'INR',
			handler: () => resolve('completed'),
			modal: { ondismiss: () => resolve(failed ? 'failed' : 'dismissed') }
		});
		// Razorpay keeps the window open after a failed attempt so the customer can retry
		checkout.on('payment.failed', () => (failed = true));
		checkout.open();
	});
}
