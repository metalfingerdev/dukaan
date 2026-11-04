<script lang="ts">
	// The payment step for an order paid online. Opens Razorpay Checkout for the order's Razorpay
	// order; when the customer finishes, asks the server to check with Razorpay. The order moves on
	// (and this disappears) only when the server has Razorpay's confirmation.
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';
	import { formatPaise, formatTime } from '../format.js';
	import { openRazorpayCheckout } from '../razorpayCheckout.js';
	import { strings } from '../strings.js';

	type Payment = {
		status: 'creating' | 'created' | 'paid' | 'failed';
		razorpayOrderId?: string;
		keyId?: string;
		amountPaise: number;
		payBy: number;
	};
	type Props = {
		orderId: string;
		orderNumber: number;
		payment: Payment;
		contact: { name: string; phone: string };
		/** Open Razorpay as soon as it is ready, right after the order was placed */
		openAtOnce: boolean;
	};
	let { orderId, orderNumber, payment, contact, openAtOnce }: Props = $props();
	const client = useConvexClient();
	const text = strings.payOnline;

	let busy = $state<'opening' | 'checking' | null>(null);
	let note = $state('');
	let opened = false;

	const ready = $derived(payment.status === 'created' && !!payment.keyId && !!payment.razorpayOrderId);

	const pay = async () => {
		if (!payment.keyId || !payment.razorpayOrderId) return;
		busy = 'opening';
		note = '';
		const result = await openRazorpayCheckout({
			key: payment.keyId,
			order_id: payment.razorpayOrderId,
			amount: payment.amountPaise,
			name: STORE_NAME,
			description: `Order #${orderNumber}`,
			prefill: { name: contact.name, contact: contact.phone }
		});
		busy = null;
		if (result === 'unavailable') note = text.scriptFailed;
		else if (result === 'failed') note = text.failed;
		else if (result === 'completed') {
			busy = 'checking';
			try {
				await client.mutation(api.store.payments.checkOnlinePayment, { orderId });
				note = text.notConfirmed;
			} catch {
				note = strings.common.error;
			} finally {
				busy = null;
			}
		}
	};

	const retry = async () => {
		note = '';
		try {
			await client.mutation(api.store.payments.retryOnlinePayment, { orderId });
		} catch {
			note = strings.common.error;
		}
	};

	// Right after checkout: open Razorpay once the payment is ready, without another tap
	$effect(() => {
		if (openAtOnce && ready && !opened) {
			opened = true;
			void pay();
		}
	});
</script>

<section class="card preset-tonal-primary flex flex-col gap-3 p-4">
	<h2 class="h5">{text.title}</h2>
	<p class="text-sm">{text.hint(formatTime(payment.payBy))}</p>

	{#if payment.status === 'creating'}
		<p class="text-sm" role="status">{text.preparing}</p>
	{:else if payment.status === 'failed'}
		<p class="text-sm" role="alert">{text.unavailable}</p>
		<button type="button" class="btn preset-tonal min-h-11 self-start" onclick={retry}>{text.retry}</button>
	{:else if ready}
		<button type="button" class="btn preset-filled-primary-500 min-h-12" disabled={busy !== null} onclick={pay}>
			{busy === 'opening' ? text.opening : busy === 'checking' ? text.checking : text.pay(formatPaise(payment.amountPaise))}
		</button>
	{/if}

	{#if note}
		<p class="text-sm" role="status">{note}</p>
	{/if}
</section>
