<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import ProductGrid from '#lib/store/ui/ProductGrid.svelte';
	import GridSkeleton from '#lib/store/ui/GridSkeleton.svelte';
	import { strings } from '#lib/store/strings.js';

	const result = useQuery(api.store.catalog.listProducts, () => ({
		categorySlug: page.params.category ?? ''
	}));
</script>

<svelte:head>
	<title>{result.data ? `${result.data.category.name} | ${STORE_NAME}` : STORE_NAME}</title>
</svelte:head>

<ShopPage>
	<a href={resolve('/')} class="text-primary-600-400 text-sm">&larr; {strings.category.back}</a>

	{#if result.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if result.data === undefined}
		<GridSkeleton />
	{:else if result.data === null}
		<div class="flex flex-col items-start gap-3">
			<p>{strings.category.notFound}</p>
			<a href={resolve('/')} class="btn preset-tonal">{strings.common.backHome}</a>
		</div>
	{:else}
		<h1 class="h4">{result.data.category.name}</h1>
		{#if result.data.products.length === 0}
			<p class="text-surface-600-400">{strings.category.empty}</p>
		{:else}
			<ProductGrid products={result.data.products} />
		{/if}
	{/if}
</ShopPage>
