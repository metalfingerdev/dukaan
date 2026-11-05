<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { formatDateTime, formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';

	const text = strings.admin.payments;
	const payments = useQuery(api.store.admin.payments.listGatewayPayments, {});
</script>

<svelte:head>
	<title>{text.title}</title>
</svelte:head>

<h1 class="title">{text.title}</h1>
<p class="muted">{text.intro}</p>

{#if payments.error}
	<p class="problem">{strings.common.error}</p>
{:else if payments.data === undefined}
	<div class="bone placeholder" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if payments.data.length === 0}
	<p class="muted">{text.empty}</p>
{:else}
	<ul class="rows">
		{#each payments.data as payment (payment.paymentId ?? payment.orderId)}
			<li>
				<Card dense>
					<div class="line" class:failed={payment.refund?.status === 'failed'}>
						<div>
							<p class="strong">
								{text.order(payment.orderNumber)} · {formatPaise(payment.amountPaise)} · {text.kind[payment.kind]}
							</p>
							<p class="muted">
								{#if payment.paidAt}{formatDateTime(payment.paidAt)} · {/if}<span class="mono">{payment.paymentId}</span>
								· {strings.orders.status[payment.orderStatus]}
							</p>
							{#if payment.refund}
								<p class="refund">
									{text.refund[payment.refund.status]}{#if payment.refund.refundId} · <span class="mono">{payment.refund.refundId}</span>{/if}
								</p>
								{#if payment.refund.error}<p class="small">{payment.refund.error}</p>{/if}
							{/if}
						</div>
						{#if payment.orderStatus === 'delivered'}
							<Button href={resolve('/admin/orders/[id]/invoice', { id: payment.orderId })}>
								{strings.admin.pastOrders.invoice}
							</Button>
						{/if}
					</div>
				</Card>
			</li>
		{/each}
	</ul>
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.title {
		@apply text-2xl font-extrabold;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.rows {
		@apply flex max-w-4xl flex-col gap-2;
	}
	.line {
		@apply flex flex-wrap items-center justify-between gap-2;
	}
	/* A refund that failed is red: someone has to do it by hand in the Razorpay dashboard */
	.failed {
		@apply -m-2.5 rounded-base bg-danger/10 p-2.5 outline-2 outline-danger;
	}
	.strong {
		@apply font-extrabold;
	}
	.mono {
		@apply font-mono;
	}
	.refund {
		@apply text-sm font-bold;
	}
	.small {
		@apply text-sm;
	}
	.placeholder {
		@apply block h-40 w-full;
	}
</style>
