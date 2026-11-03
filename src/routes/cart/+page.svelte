<script lang="ts">
	import { resolve } from '$app/paths';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import AddToCart from '#lib/store/ui/AddToCart.svelte';
	import CartBill from '#lib/store/ui/CartBill.svelte';
	import { getCartContext } from '#lib/store/cart.context.js';
	import { effectiveQuantity } from '#lib/store/cart.svelte.js';
	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	const cart = getCartContext();

	const pricing = $derived(cart.pricing);
	const info = $derived(cart.storeInfo);
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

		{#if pricing && info}
			<CartBill
				{pricing}
				freeDeliveryAbovePaise={info.freeDeliveryAbovePaise}
				minOrderPaise={info.minOrderPaise}
			/>
		{/if}

		<!-- Checkout is private: a signed-out visitor is sent to sign in and lands back here, with
			the guest cart merged -->
		<a href={resolve('/checkout')} class="btn preset-filled min-h-12">{strings.cart.checkout}</a>
	{/if}
</ShopPage>
