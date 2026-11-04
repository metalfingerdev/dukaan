<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { SLOT_MINUTES, STORE_NAME } from '#convex/model/store/storeProfile.js';

	import SendLocation from '#lib/store/ui/SendLocation.svelte';
	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import { getCartContext } from '#lib/store/cart.context.js';
	import { formatDateTime, formatPaise, formatSlot } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import { useRequireSignIn } from '#lib/store/requireSignIn.svelte.js';

	const auth = useRequireSignIn();
	const client = useConvexClient();
	const cart = getCartContext();

	// Live: the timeline moves on its own as the store works the order. `getOrder` returns `null`
	// for an unknown id and for someone else's order alike.
	const result = useQuery(api.store.orders.getOrder, () =>
		auth.isAuthenticated ? { orderId: page.params.id ?? '' } : 'skip'
	);
	const order = $derived(result.data);
	const justPlaced = $derived(page.url.searchParams.get('placed') === '1');
	const storePhone = $derived(cart.storeInfo?.storePhone);

	let cancelling = $state(false);
	let cancelFailed = $state(false);

	const cancel = async () => {
		if (!order || !confirm(strings.orders.confirmCancel)) return;
		cancelling = true;
		cancelFailed = false;
		try {
			await client.mutation(api.store.orders.cancelOrder, { orderId: order._id });
		} catch {
			cancelFailed = true;
		} finally {
			cancelling = false;
		}
	};
</script>

<svelte:head>
	<title>
		{order ? strings.orders.orderNumber(order.orderNumber) : strings.orders.title} | {STORE_NAME}
	</title>
</svelte:head>

<ShopPage>
	<a href={resolve('/orders')} class="text-primary-600-400 text-sm">&larr; {strings.orders.backToOrders}</a>

	{#if result.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if result.data === undefined}
		<div class="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
			{#each { length: 3 } as _, i (i)}
				<div class="bg-surface-100-900 h-24 animate-pulse rounded"></div>
			{/each}
		</div>
	{:else if !order}
		<div class="flex flex-col items-start gap-3">
			<p>{strings.orders.notFound}</p>
			<a href={resolve('/orders')} class="btn preset-tonal">{strings.orders.backToOrders}</a>
		</div>
	{:else}
		{#if justPlaced && order.status === 'placed'}
			<p class="card preset-tonal-success p-3" role="status">{strings.orders.placedBanner}</p>
		{/if}

		<header class="flex items-start justify-between gap-3">
			<div>
				<h1 class="h4">{strings.orders.orderNumber(order.orderNumber)}</h1>
				<p class="text-surface-600-400 text-sm">{formatDateTime(order.placedAt)}</p>
			</div>
			<span class="badge preset-filled-primary-500">{strings.orders.status[order.status]}</span>
		</header>

		{#if order.deliveryCode}
			<section class="card preset-tonal-primary flex flex-col items-center gap-1 p-4 text-center">
				<p class="font-medium">{strings.orders.codeTitle}</p>
				<p class="font-mono text-4xl font-bold tracking-widest" aria-label="Delivery code">
					{order.deliveryCode}
				</p>
				<p class="text-sm">
					{order.status === 'out_for_delivery' ? strings.orders.codeOnTheWay : strings.orders.codeKeep}
				</p>
			</section>
		{/if}

		{#if order.status === 'out_for_delivery' || order.status === 'delivery_failed' || order.status === 'packed'}
			<SendLocation orderId={order._id} />
		{/if}

		{#if order.status === 'cancelled'}
			<p class="text-surface-600-400">{strings.orders.cancelledNote}</p>
		{/if}

		<section class="flex flex-col gap-2">
			<h2 class="h5">{strings.orders.timeline}</h2>
			<ol class="flex flex-col gap-1">
				{#each order.events as event (event.at + event.status)}
					<li class="flex justify-between gap-3 text-sm">
						<span>{strings.orders.status[event.status]}{#if event.note} &middot; {event.note}{/if}</span>
						<span class="text-surface-600-400">{formatDateTime(event.at)}</span>
					</li>
				{/each}
			</ol>
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="h5">{strings.orders.items}</h2>
			<ul class="flex flex-col gap-1">
				{#each order.items as item (item.name + item.unitLabel)}
					<li class="flex justify-between gap-3">
						<span>
							{item.name}
							<span class="text-surface-600-400 text-sm">{item.unitLabel} &times; {item.quantity}</span>
						</span>
						<span>{formatPaise(item.unitPricePaise * item.quantity)}</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="card preset-outlined-surface-300-700 flex flex-col gap-1 p-3" aria-label={strings.orders.bill}>
			<dl class="flex flex-col gap-1 text-sm">
				<div class="flex justify-between">
					<dt>{strings.cart.itemTotal}</dt>
					<dd>{formatPaise(order.subtotalPaise)}</dd>
				</div>
				<div class="flex justify-between">
					<dt>{strings.cart.deliveryFee}</dt>
					<dd>{order.deliveryFeePaise === 0 ? strings.cart.free : formatPaise(order.deliveryFeePaise)}</dd>
				</div>
				{#if order.smallCartFeePaise > 0}
					<div class="flex justify-between">
						<dt>{strings.cart.handlingFee}</dt>
						<dd>{formatPaise(order.smallCartFeePaise)}</dd>
					</div>
				{/if}
				{#if order.savingsPaise > 0}
					<div class="text-success-600-400 flex justify-between">
						<dt>{strings.cart.youSave}</dt>
						<dd>{formatPaise(order.savingsPaise)}</dd>
					</div>
				{/if}
				<div class="border-surface-300-700 mt-1 flex justify-between border-t pt-2 text-base font-semibold">
					<dt>{strings.cart.total}</dt>
					<dd>{formatPaise(order.totalPaise)}</dd>
				</div>
			</dl>
			<p class="text-surface-600-400 text-sm">
				{strings.orders.paymentMethod[order.paymentMethod]} &middot; {strings.orders.paymentStatus[order.paymentStatus]}
			</p>
		</section>

		<section class="flex flex-col gap-1 text-sm">
			<h2 class="h5">{strings.orders.deliveringTo}</h2>
			<p>{order.address.contactName}, {order.address.contactPhone}</p>
			<p>{order.address.line1}</p>
			<p class="text-surface-600-400">
				{order.address.area}{#if order.address.landmark} &middot; {order.address.landmark}{/if}
			</p>
			<p>
				<span class="text-surface-600-400">{strings.orders.deliveryTime}:</span>
				{order.slotStartMs === undefined ? strings.orders.asap : formatSlot(order.slotStartMs, SLOT_MINUTES)}
			</p>
			{#if order.customerNote}
				<p><span class="text-surface-600-400">{strings.orders.note}:</span> {order.customerNote}</p>
			{/if}
		</section>

		{#if order.status === 'placed'}
			<button type="button" class="btn preset-tonal-error min-h-12" disabled={cancelling} onclick={cancel}>
				{strings.orders.cancel}
			</button>
			{#if cancelFailed}
				<p class="text-error-600-400 text-sm" role="alert">{strings.orders.cancelFailed}</p>
			{/if}
		{:else if order.status !== 'cancelled' && order.status !== 'delivered'}
			<p class="text-surface-600-400 text-sm">{strings.orders.cantCancel}</p>
			{#if storePhone}
				<a href={`tel:${storePhone}`} class="btn preset-tonal min-h-12">{strings.orders.callStore}</a>
			{:else}
				<p class="text-sm">{strings.orders.contactStore}</p>
			{/if}
		{/if}
	{/if}
</ShopPage>
