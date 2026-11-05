<script lang="ts">
	import { formatPaise, percentOff } from '#lib/store/format.js';
	import type { DemoProduct } from './data.js';

	let { product, quantity = 0 }: { product: DemoProduct; quantity?: number } = $props();

	const off = $derived(percentOff(product.pricePaise, product.mrpPaise));
</script>

<div class="d-card tile">
	<div class="d-img">photo</div>
	<h3 class="name">{product.name}</h3>
	<p class="d-muted">{product.unit}</p>
	<p class="price">
		<b>{formatPaise(product.pricePaise)}</b>
		{#if off !== null}
			<s class="d-strike">{formatPaise(product.mrpPaise)}</s>
			<span class="d-pill d-pill-warn">{off}% off</span>
		{/if}
	</p>
	{#if product.stock === 'out'}
		<p class="out">Out of stock</p>
	{:else}
		{#if product.stock === 'low'}<p class="low">Only {product.stockLeft} left</p>{/if}
		{#if quantity === 0}
			<button type="button" class="d-btn d-btn-primary d-btn-block">Add</button>
		{:else}
			<div class="d-between">
				<button type="button" class="d-btn d-btn-accent step" aria-label="Remove one">&minus;</button>
				<b>{quantity}</b>
				<button type="button" class="d-btn d-btn-primary step" aria-label="Add one">+</button>
			</div>
		{/if}
	{/if}
</div>

<style lang="postcss">
	@reference 'src/app.css';

	.tile {
		@apply flex h-full flex-col gap-2;
	}
	.name {
		@apply line-clamp-2 min-h-[2lh] leading-snug font-semibold;
	}
	.price {
		@apply flex flex-wrap items-baseline gap-x-2 text-lg;
	}
	.out {
		@apply text-danger text-sm font-semibold;
	}
	.low {
		@apply text-warning text-sm font-semibold;
	}
	.step {
		@apply min-w-11 px-0 text-lg;
	}
</style>
