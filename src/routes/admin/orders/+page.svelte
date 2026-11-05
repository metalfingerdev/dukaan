<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { usePaginatedQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { formatDateTime, formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';

	const text = strings.admin.pastOrders;
	const orders = usePaginatedQuery(api.store.admin.orders.listDelivered, {}, { initialNumItems: 20 });
</script>

<svelte:head>
	<title>{text.title}</title>
</svelte:head>

<h1 class="title">{text.title}</h1>
<p class="muted">{text.intro}</p>

{#if orders.error}
	<p class="problem">{strings.common.error}</p>
{:else if orders.status === 'LoadingFirstPage'}
	<div class="bone holder" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if orders.results.length === 0}
	<p class="muted">{text.empty}</p>
{:else}
	<ul class="rows">
		{#each orders.results as order (order._id)}
			<li>
				<Card dense>
					<div class="line">
						<div>
							<p class="strong">#{order.orderNumber} · {formatPaise(order.totalPaise)}</p>
							<p class="muted">
								{order.contactName} · {order.area}{#if order.deliveredAt} · {formatDateTime(order.deliveredAt)}{/if}
							</p>
						</div>
						{#if order.invoiceNumber}
							<Button href={resolve('/admin/orders/[id]/invoice', { id: order._id })}>
								{text.invoice} {order.invoiceNumber}
							</Button>
						{/if}
					</div>
				</Card>
			</li>
		{/each}
	</ul>
	{#if orders.status === 'CanLoadMore' || orders.status === 'LoadingMore'}
		<Button disabled={orders.status === 'LoadingMore'} onclick={() => orders.loadMore(20)}>
			{text.loadMore}
		</Button>
	{/if}
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
	.strong {
		@apply font-extrabold;
	}
	.holder {
		@apply block h-40 w-full;
	}
</style>
