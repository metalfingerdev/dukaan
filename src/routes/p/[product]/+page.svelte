<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import ProductGrid from '#lib/store/ui/ProductGrid.svelte';
	import { formatPaise, percentOff } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	const result = useQuery(api.store.catalog.getProduct, () => ({
		slug: page.params.product ?? ''
	}));

	const product = $derived(result.data?.product);
	const off = $derived(product ? percentOff(product.pricePaise, product.mrpPaise) : null);
</script>

<svelte:head>
	<title>{product ? `${product.name} | ${STORE_NAME}` : STORE_NAME}</title>
</svelte:head>

<ShopPage>
	{#if result.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if result.data === undefined}
		<div class="grid animate-pulse gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading">
			<div class="bg-surface-100-900 aspect-square rounded"></div>
			<div class="flex flex-col gap-3">
				<div class="bg-surface-100-900 h-7 w-3/4 rounded"></div>
				<div class="bg-surface-100-900 h-5 w-1/4 rounded"></div>
				<div class="bg-surface-100-900 h-8 w-1/3 rounded"></div>
			</div>
		</div>
	{:else if result.data === null}
		<div class="flex flex-col items-start gap-3">
			<p>{strings.product.notFound}</p>
			<a href={resolve('/')} class="btn preset-tonal">{strings.common.backHome}</a>
		</div>
	{:else if product}
		<a
			href={resolve('/c/[category]', { category: result.data.category.slug })}
			class="text-primary-600-400 text-sm">&larr; {result.data.category.name}</a
		>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="bg-surface-100-900 aspect-square w-full overflow-hidden rounded">
				{#if product.imageUrl}
					<img
						src={product.imageUrl}
						alt={product.name}
						width="600"
						height="600"
						class="size-full object-cover"
					/>
				{/if}
			</div>
			<div class="flex flex-col gap-2">
				<h1 class="h4">{product.name}</h1>
				<p class="text-surface-600-400">{product.unitLabel}</p>
				<p class="flex flex-wrap items-baseline gap-x-3">
					<span class="text-2xl font-semibold">{formatPaise(product.pricePaise)}</span>
					{#if off !== null}
						<s class="text-surface-600-400">{formatPaise(product.mrpPaise)}</s>
						<span class="text-success-600-400 font-medium">{strings.product.percentOff(off)}</span>
					{/if}
				</p>
				{#if !product.inStock}
					<p class="text-error-600-400 font-medium">{strings.product.outOfStock}</p>
				{:else}
					{#if product.lowStock && product.stockLeft !== undefined}
						<p class="text-warning-700-300 font-medium">
							{strings.product.onlyLeft(product.stockLeft)}
						</p>
					{/if}
					<p class="text-surface-600-400 text-sm">
						{strings.product.maxPerOrder(product.maxQuantity)}
					</p>
				{/if}
			</div>
		</div>

		{#if result.data.related.length > 0}
			<section class="flex flex-col gap-3">
				<h2 class="h5">{strings.product.moreInCategory}</h2>
				<ProductGrid products={result.data.related} />
			</section>
		{/if}
	{/if}
</ShopPage>
