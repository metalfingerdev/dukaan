<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { formatDateTime, formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	const text = strings.admin.payments;
	const payments = useQuery(api.store.admin.payments.listGatewayPayments, {});
</script>

<svelte:head>
	<title>{text.title}</title>
</svelte:head>

<h1 class="h3">{text.title}</h1>
<p class="text-surface-600-400 text-sm">{text.intro}</p>

{#if payments.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if payments.data === undefined}
	<div class="bg-surface-100-900 h-40 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if payments.data.length === 0}
	<p class="text-surface-600-400 text-sm">{text.empty}</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each payments.data as payment (payment.paymentId ?? payment.orderId)}
			<li
				class="card flex flex-wrap items-center justify-between gap-2 p-3 {payment.refund?.status === 'failed'
					? 'preset-tonal-error'
					: 'preset-outlined-surface-300-700'}"
			>
				<div>
					<p class="font-semibold">
						{text.order(payment.orderNumber)} · {formatPaise(payment.amountPaise)} · {text.kind[payment.kind]}
					</p>
					<p class="text-surface-600-400 text-sm">
						{#if payment.paidAt}{formatDateTime(payment.paidAt)} · {/if}<span class="font-mono">{payment.paymentId}</span>
						· {strings.orders.status[payment.orderStatus]}
					</p>
					{#if payment.refund}
						<p class="text-sm font-medium">
							{text.refund[payment.refund.status]}{#if payment.refund.refundId} · <span class="font-mono">{payment.refund.refundId}</span>{/if}
						</p>
						{#if payment.refund.error}<p class="text-sm">{payment.refund.error}</p>{/if}
					{/if}
				</div>
				{#if payment.orderStatus === 'delivered'}
					<a href={resolve('/admin/orders/[id]/invoice', { id: payment.orderId })} class="btn preset-tonal min-h-11">
						{strings.admin.pastOrders.invoice}
					</a>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
