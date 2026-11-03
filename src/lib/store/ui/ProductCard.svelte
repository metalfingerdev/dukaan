<script lang="ts">
	import { resolve } from '$app/paths';

	import { formatPaise, percentOff } from '../format.js';
	import { strings } from '../strings.js';
	import type { PublicProduct } from '../types.js';

	let { product }: { product: PublicProduct } = $props();

	const off = $derived(percentOff(product.pricePaise, product.mrpPaise));
</script>

<a
	href={resolve('/p/[product]', { product: product.slug })}
	class="card preset-outlined-surface-300-700 flex flex-col gap-1 p-3"
>
	<!-- Fixed aspect ratio so the grid doesn't jump when images arrive -->
	<div class="bg-surface-100-900 aspect-square w-full overflow-hidden rounded">
		{#if product.imageUrl}
			<img
				src={product.imageUrl}
				alt=""
				width="300"
				height="300"
				loading="lazy"
				class="size-full object-cover"
			/>
		{/if}
	</div>
	<h3 class="line-clamp-2 min-h-[2lh] font-medium">{product.name}</h3>
	<p class="text-surface-600-400 text-sm">{product.unitLabel}</p>
	<p class="flex flex-wrap items-baseline gap-x-2">
		<span class="font-semibold">{formatPaise(product.pricePaise)}</span>
		{#if off !== null}
			<s class="text-surface-600-400 text-sm">{formatPaise(product.mrpPaise)}</s>
			<span class="text-success-600-400 text-sm">{strings.product.percentOff(off)}</span>
		{/if}
	</p>
	{#if !product.inStock}
		<p class="text-error-600-400 text-sm font-medium">{strings.product.outOfStock}</p>
	{:else if product.lowStock && product.stockLeft !== undefined}
		<p class="text-warning-700-300 text-sm font-medium">{strings.product.onlyLeft(product.stockLeft)}</p>
	{/if}
</a>
