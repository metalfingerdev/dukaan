<script lang="ts">
	import { page } from '$app/state';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import ProductGrid from '#lib/store/ui/ProductGrid.svelte';
	import GridSkeleton from '#lib/store/ui/GridSkeleton.svelte';
	import { strings } from '#lib/store/strings.js';

	const MIN_LENGTH = 2;

	const query = $derived((page.url.searchParams.get('q') ?? '').trim());
	const results = useQuery(api.store.catalog.searchProducts, () =>
		query.length >= MIN_LENGTH ? { q: query } : 'skip'
	);
</script>

<svelte:head>
	<title>{query ? strings.search.resultsFor(query) : 'Search'} | {STORE_NAME}</title>
</svelte:head>

<ShopPage>
	{#if query.length < MIN_LENGTH}
		<p class="text-surface-600-400">{strings.search.prompt}</p>
	{:else if results.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if results.data === undefined}
		<GridSkeleton />
	{:else}
		<h1 class="h5">{strings.search.resultsFor(query)}</h1>
		{#if results.data.length === 0}
			<p class="text-surface-600-400">{strings.search.noResults(query)}</p>
		{:else}
			<ProductGrid products={results.data} />
		{/if}
	{/if}
</ShopPage>
