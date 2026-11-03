<script lang="ts">
	import { resolve } from '$app/paths';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import AddToCart from '#lib/store/ui/AddToCart.svelte';
	import { getCartContext } from '#lib/store/cart.context.js';
	import { effectiveQuantity } from '#lib/store/cart.svelte.js';
	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	const cart = getCartContext();

	const pricing = $derived(cart.pricing);
	const info = $derived(cart.storeInfo);
	const toFreeDelivery = $derived(
		pricing && info && pricing.deliveryFeePaise > 0
			? info.freeDeliveryAbovePaise - pricing.subtotalPaise
			: 0
	);
	const belowMinimum = $derived(
		pricing && info && pricing.subtotalPaise > 0 && pricing.subtotalPaise < info.minOrderPaise
	);
</script>

<svelte:head>
	<title>{strings.cart.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage showCartBar={false}>
	<h1 class="h4">{strings.cart.title}</h1>

	{#if cart.isLoading}
		<ul class="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
			{#each { length: 3 } as _, i (i)}
				<li class="bg-surface-100-900 h-24 animate-pulse rounded"></li>
			{/each}
		</ul>
	{:else if cart.lines.length === 0}
		<div class="flex flex-col items-start gap-3">
			<p class="text-surface-600-400">{strings.cart.empty}</p>
			<a href={resolve('/')} class="btn preset-filled">{strings.cart.keepShopping}</a>
		</div>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each cart.lines as line (line.productId)}
				{@const quantity = effectiveQuantity(line)}
				<li class="card preset-outlined-surface-300-700 flex flex-col gap-2 p-3">
					<div class="flex items-start justify-between gap-3">
						<a href={resolve('/p/[product]', { product: line.product.slug })} class="font-medium">
							{line.product.name}
							<span class="text-surface-600-400 block text-sm font-normal">{line.product.unitLabel}</span>
						</a>
						{#if quantity > 0}
							<span class="font-semibold">{formatPaise(line.product.pricePaise * quantity)}</span>
						{/if}
					</div>
					{#if quantity === 0}
						<p class="text-error-600-400 text-sm">{strings.cart.unavailable}</p>
						<button
							type="button"
							class="btn preset-tonal min-h-11 self-start"
							onclick={() => cart.setQuantity(line.product, 0)}>{strings.cart.remove}</button
						>
					{:else}
						<div class="max-w-xs"><AddToCart product={line.product} /></div>
						{#if line.quantity > quantity}
							<p class="text-warning-700-300 text-xs">{strings.cart.onlyAvailable(quantity)}</p>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>

		{#if pricing}
			<section class="card preset-outlined-surface-300-700 flex flex-col gap-2 p-3" aria-label="Bill">
				<dl class="flex flex-col gap-1 text-sm">
					<div class="flex justify-between">
						<dt>{strings.cart.itemTotal}</dt>
						<dd>{formatPaise(pricing.subtotalPaise)}</dd>
					</div>
					<div class="flex justify-between">
						<dt>{strings.cart.deliveryFee}</dt>
						<dd>{pricing.deliveryFeePaise === 0 ? strings.cart.free : formatPaise(pricing.deliveryFeePaise)}</dd>
					</div>
					{#if pricing.smallCartFeePaise > 0}
						<div class="flex justify-between">
							<dt>{strings.cart.handlingFee}</dt>
							<dd>{formatPaise(pricing.smallCartFeePaise)}</dd>
						</div>
					{/if}
					{#if pricing.savingsPaise > 0}
						<div class="text-success-600-400 flex justify-between">
							<dt>{strings.cart.youSave}</dt>
							<dd>{formatPaise(pricing.savingsPaise)}</dd>
						</div>
					{/if}
					<div class="border-surface-300-700 mt-1 flex justify-between border-t pt-2 text-base font-semibold">
						<dt>{strings.cart.total}</dt>
						<dd>{formatPaise(pricing.totalPaise)}</dd>
					</div>
				</dl>
				{#if toFreeDelivery > 0}
					<p class="text-sm">{strings.cart.addForFreeDelivery(formatPaise(toFreeDelivery))}</p>
				{/if}
				{#if belowMinimum && info}
					<p class="text-warning-700-300 text-sm" role="status">
						{strings.cart.minimumOrder(formatPaise(info.minOrderPaise))}
					</p>
				{/if}
			</section>
		{/if}

		<!-- Checkout is the next piece of work; the button is here so the cart reads as complete -->
		<button type="button" class="btn preset-filled min-h-12" disabled>{strings.cart.checkout}</button>
		<p class="text-surface-600-400 text-center text-sm">{strings.cart.checkoutSoon}</p>
	{/if}
</ShopPage>
