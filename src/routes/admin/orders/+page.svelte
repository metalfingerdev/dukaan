<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { usePaginatedQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { formatDateTime, formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	const text = strings.admin.pastOrders;
	const orders = usePaginatedQuery(api.store.admin.orders.listDelivered, {}, { initialNumItems: 20 });
</script>

<svelte:head>
	<title>{text.title}</title>
</svelte:head>

<h1 class="h3">{text.title}</h1>
<p class="text-surface-600-400 text-sm">{text.intro}</p>

{#if orders.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if orders.status === 'LoadingFirstPage'}
	<div class="bg-surface-100-900 h-40 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if orders.results.length === 0}
	<p class="text-surface-600-400 text-sm">{text.empty}</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each orders.results as order (order._id)}
			<li class="card preset-outlined-surface-300-700 flex flex-wrap items-center justify-between gap-2 p-3">
				<div>
					<p class="font-semibold">#{order.orderNumber} · {formatPaise(order.totalPaise)}</p>
					<p class="text-surface-600-400 text-sm">
						{order.contactName} · {order.area}{#if order.deliveredAt} · {formatDateTime(order.deliveredAt)}{/if}
					</p>
				</div>
				{#if order.invoiceNumber}
					<a href={resolve('/admin/orders/[id]/invoice', { id: order._id })} class="btn preset-tonal min-h-11">
						{text.invoice} {order.invoiceNumber}
					</a>
				{/if}
			</li>
		{/each}
	</ul>
	{#if orders.status === 'CanLoadMore' || orders.status === 'LoadingMore'}
		<button
			type="button"
			class="btn preset-tonal min-h-11 self-start"
			disabled={orders.status === 'LoadingMore'}
			onclick={() => orders.loadMore(20)}
		>
			{text.loadMore}
		</button>
	{/if}
{/if}
