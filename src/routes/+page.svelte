<script lang="ts">
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import ProductGrid from '#lib/store/ui/ProductGrid.svelte';
	import GridSkeleton from '#lib/store/ui/GridSkeleton.svelte';
	import { strings } from '#lib/store/strings.js';

	const categories = useQuery(api.store.catalog.listCategories, {});
	const featured = useQuery(api.store.catalog.listFeatured, {});
</script>

<svelte:head>
	<title>{STORE_NAME}</title>
</svelte:head>

<ShopPage>
	<section class="flex flex-col gap-3">
		<h2 class="h5">{strings.home.categories}</h2>
		{#if categories.error}
			<p class="text-error-600-400 text-sm">{strings.common.error}</p>
		{:else if categories.data === undefined}
			<GridSkeleton count={6} />
		{:else if categories.data.length === 0}
			<p class="text-surface-600-400">{strings.home.empty}</p>
		{:else}
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each categories.data as category (category._id)}
					<li>
						<a
							href={resolve('/c/[category]', { category: category.slug })}
							class="card preset-outlined-surface-300-700 flex min-h-16 items-center gap-3 p-3 font-medium"
						>
							{#if category.imageUrl}
								<img
									src={category.imageUrl}
									alt=""
									width="48"
									height="48"
									loading="lazy"
									class="size-12 rounded object-cover"
								/>
							{/if}
							<span>{category.name}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if featured.data && featured.data.length > 0}
		<section class="flex flex-col gap-3">
			<h2 class="h5">{strings.home.featured}</h2>
			<ProductGrid products={featured.data} />
		</section>
	{:else if featured.data === undefined && !featured.error}
		<GridSkeleton count={4} />
	{/if}
</ShopPage>
