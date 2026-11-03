<script lang="ts">
	import { getCartContext } from '../cart.context.js';
	import { strings } from '../strings.js';
	import type { PublicProduct } from '../types.js';

	let { product }: { product: PublicProduct } = $props();

	const cart = getCartContext();
	const quantity = $derived(cart.quantityOf(product._id));
	const atMax = $derived(quantity > 0 && quantity >= product.maxQuantity);

	let busy = $state(false);
	let note = $state('');

	const change = async (next: number) => {
		busy = true;
		note = '';
		const status = await cart.setQuantity(product, next);
		if (status === 'clamped') note = strings.cart.onlyAvailable(product.maxQuantity);
		else if (status === 'out_of_stock' || status === 'unavailable') note = strings.cart.unavailable;
		else if (status === 'error') note = strings.common.error;
		busy = false;
	};
</script>

{#if product.inStock && product.maxQuantity > 0}
	{#if quantity === 0}
		<button
			type="button"
			class="btn preset-filled min-h-11 w-full"
			disabled={busy}
			onclick={() => change(1)}
		>
			{strings.product.add}
		</button>
	{:else}
		<div class="flex items-center justify-between gap-2">
			<button
				type="button"
				class="btn preset-tonal min-h-11 min-w-11 text-lg"
				aria-label={strings.cart.removeOne}
				disabled={busy}
				onclick={() => change(quantity - 1)}>&minus;</button
			>
			<span class="min-w-8 text-center font-semibold" aria-live="polite">{quantity}</span>
			<button
				type="button"
				class="btn preset-tonal min-h-11 min-w-11 text-lg"
				aria-label={strings.cart.addOne}
				disabled={busy || atMax}
				onclick={() => change(quantity + 1)}>+</button
			>
		</div>
		{#if atMax && !note}
			<p class="text-surface-600-400 text-center text-xs">{strings.cart.maxReached(product.maxQuantity)}</p>
		{/if}
	{/if}
	{#if note}
		<p class="text-warning-700-300 text-center text-xs" role="status">{note}</p>
	{/if}
{/if}
