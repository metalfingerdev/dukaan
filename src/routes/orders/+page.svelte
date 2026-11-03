<script lang="ts">
	import { resolve } from '$app/paths';
	import { usePaginatedQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import { formatDateTime, formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import { useRequireSignIn } from '#lib/store/requireSignIn.svelte.js';

	const auth = useRequireSignIn();

	// Private page; `listMyOrders` only ever returns the signed-in customer's own orders
	const orders = usePaginatedQuery(
		api.store.orders.listMyOrders,
		() => (auth.isAuthenticated ? {} : 'skip'),
		{ initialNumItems: 10 }
	);
</script>

<svelte:head>
	<title>{strings.orders.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage>
	<h1 class="h4">{strings.orders.title}</h1>

	{#if orders.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if orders.status === 'LoadingFirstPage'}
		<ul class="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
			{#each { length: 3 } as _, i (i)}
				<li class="bg-surface-100-900 h-20 animate-pulse rounded"></li>
			{/each}
		</ul>
	{:else if orders.results.length === 0}
		<div class="flex flex-col items-start gap-3">
			<p class="text-surface-600-400">{strings.orders.empty}</p>
			<a href={resolve('/')} class="btn preset-filled">{strings.orders.startShopping}</a>
		</div>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each orders.results as order (order._id)}
				<li>
					<a
						href={resolve('/orders/[id]', { id: order._id })}
						class="card preset-outlined-surface-300-700 flex min-h-11 items-center justify-between gap-3 p-3"
					>
						<span class="flex flex-col">
							<span class="font-medium">{strings.orders.orderNumber(order.orderNumber)}</span>
							<span class="text-surface-600-400 text-sm">{formatDateTime(order.placedAt)}</span>
						</span>
						<span class="flex flex-col items-end">
							<span class="font-semibold">{formatPaise(order.totalPaise)}</span>
							<span class="text-sm">{strings.orders.status[order.status]}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
		{#if orders.status === 'CanLoadMore' || orders.status === 'LoadingMore'}
			<button
				type="button"
				class="btn preset-tonal min-h-11 self-start"
				disabled={orders.status === 'LoadingMore'}
				onclick={() => orders.loadMore(10)}
			>
				{strings.orders.loadMore}
			</button>
		{/if}
	{/if}
</ShopPage>
