<script lang="ts">
	// Pay by UPI through a Razorpay QR fixed to the order total. The page asks for the QR; the
	// server makes it; "Paid" appears only when Razorpay confirms the payment. Used on the rider's
	// order page and on the customer's.
	import { ConvexError } from 'convex/values';
	import { formatPaise, formatTime } from '../format.js';
	import { createClock } from '../now.svelte.js';
	import { strings } from '../strings.js';

	type Qr = {
		status: 'creating' | 'active' | 'paid' | 'failed';
		imageUrl?: string;
		closeBy?: number;
		amountPaise: number;
	};
	type Props = {
		qr: Qr | undefined;
		amountPaise: number;
		/** Rider or customer wording */
		forRider: boolean;
		request: () => Promise<unknown>;
		check: () => Promise<unknown>;
	};
	let { qr, amountPaise, forRider, request, check }: Props = $props();
	const text = strings.upiQr;
	const clock = createClock(15_000);

	let busy = $state<'request' | 'check' | null>(null);
	let problem = $state('');

	const expired = $derived(qr?.status === 'active' && (qr.closeBy ?? 0) <= clock.now);
	// Nothing to show yet, or the last QR can't be used: offer to make one
	const offerNew = $derived(!qr || qr.status === 'failed' || expired);

	const run = async (kind: 'request' | 'check', call: () => Promise<unknown>) => {
		busy = kind;
		problem = '';
		try {
			await call();
		} catch (error) {
			const code = error instanceof ConvexError ? (error.data as { code?: string })?.code : undefined;
			problem = code === 'NOT_PAYABLE' ? text.notPayable : strings.common.error;
		} finally {
			busy = null;
		}
	};
</script>

<section class="card preset-outlined-surface-300-700 flex flex-col items-center gap-3 p-4 text-center">
	{#if qr?.status === 'paid'}
		<p class="preset-filled-success-500 w-full rounded p-3 text-xl font-bold" role="status">
			{text.paid} · {formatPaise(qr.amountPaise)}
		</p>
	{:else if qr?.status === 'creating'}
		<p class="text-surface-600-400" role="status">{text.making}</p>
	{:else if qr?.status === 'active' && !expired}
		<p class="font-semibold">{text.scan(formatPaise(qr.amountPaise))}</p>
		{#if qr.imageUrl}
			<img
				src={qr.imageUrl}
				alt={text.qrLabel(formatPaise(qr.amountPaise))}
				class="size-64 rounded bg-white object-contain"
				referrerpolicy="no-referrer"
			/>
		{/if}
		<p class="text-sm" role="status">{text.waiting}</p>
		{#if qr.closeBy}
			<p class="text-surface-600-400 text-xs">{text.expires(formatTime(qr.closeBy))}</p>
		{/if}
		<button
			type="button"
			class="btn preset-tonal min-h-11"
			disabled={busy !== null}
			onclick={() => run('check', check)}
		>
			{busy === 'check' ? text.checking : text.check}
		</button>
	{/if}

	{#if offerNew}
		{#if qr?.status === 'failed'}
			<p class="text-warning-700-300 text-sm" role="alert">{forRider ? text.failedRider : text.failed}</p>
		{/if}
		<button
			type="button"
			class="btn preset-filled-primary-500 min-h-12"
			disabled={busy !== null}
			onclick={() => run('request', request)}
		>
			{qr?.status === 'failed' ? text.tryAgain : forRider ? text.showRider : text.show}
			· {formatPaise(amountPaise)}
		</button>
	{/if}

	{#if problem}
		<p class="text-error-600-400 text-sm" role="alert">{problem}</p>
	{/if}
</section>
