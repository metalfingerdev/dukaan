<script lang="ts">
	// Pay by UPI through a Razorpay QR fixed to the order total. The page asks for the QR; the
	// server makes it; "Paid" appears only when Razorpay confirms the payment. Used on the rider's
	// order page and on the customer's.
	import { ConvexError } from 'convex/values';
	import { formatPaise, formatTime } from '../format.js';
	import { createClock } from '../now.svelte.js';
	import { strings } from '../strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';

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

<Card as="section">
	<div class="box">
		{#if qr?.status === 'paid'}
			<p class="paid" role="status">
				{text.paid} · {formatPaise(qr.amountPaise)}
			</p>
		{:else if qr?.status === 'creating'}
			<p class="muted" role="status">{text.making}</p>
		{:else if qr?.status === 'active' && !expired}
			<p class="scan">{text.scan(formatPaise(qr.amountPaise))}</p>
			{#if qr.imageUrl}
				<img
					src={qr.imageUrl}
					alt={text.qrLabel(formatPaise(qr.amountPaise))}
					class="qr"
					referrerpolicy="no-referrer"
				/>
			{/if}
			<p class="small" role="status">{text.waiting}</p>
			{#if qr.closeBy}
				<p class="muted tiny">{text.expires(formatTime(qr.closeBy))}</p>
			{/if}
			<Button disabled={busy !== null} onclick={() => run('check', check)}>
				{busy === 'check' ? text.checking : text.check}
			</Button>
		{/if}

		{#if offerNew}
			{#if qr?.status === 'failed'}
				<p class="warning" role="alert">{forRider ? text.failedRider : text.failed}</p>
			{/if}
			<Button variant="primary" large disabled={busy !== null} onclick={() => run('request', request)}>
				{qr?.status === 'failed' ? text.tryAgain : forRider ? text.showRider : text.show}
				· {formatPaise(amountPaise)}
			</Button>
		{/if}

		{#if problem}
			<p class="problem" role="alert">{problem}</p>
		{/if}
	</div>
</Card>

<style lang="postcss">
	@reference 'src/app.css';

	.box {
		@apply flex flex-col items-center gap-3 text-center;
	}
	.paid {
		--fill: var(--color-success);
		@apply edge-flat w-full rounded-lg bg-success p-3 text-xl font-extrabold text-foreground;
	}
	.scan {
		@apply font-bold;
	}
	/* A QR code needs a light background and no tint to scan, whatever the theme */
	.qr {
		@apply size-64 rounded-lg bg-white object-contain;
	}
	.muted {
		@apply text-text-muted;
	}
	.small {
		@apply text-sm;
	}
	.tiny {
		@apply text-xs;
	}
	.warning {
		@apply text-sm font-semibold text-warning;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
</style>
