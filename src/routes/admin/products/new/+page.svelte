<script lang="ts">
	// Access is checked by ../../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import ProductForm from '#lib/store/admin/ProductForm.svelte';
	import { strings } from '#lib/store/strings.js';

	const categories = useQuery(api.store.admin.categories.listCategories, {});
	const text = strings.admin.products;
	// Opened from a category's list: start with that category chosen
	const initialCategoryId = (page.url.searchParams.get('category') ?? undefined) as
		| Id<'categories'>
		| undefined;
</script>

<svelte:head>
	<title>{text.form.newTitle} | {strings.admin.title}</title>
</svelte:head>

<a href={resolve('/admin/products')} class="text-primary-600-400 text-sm">&larr; {text.form.back}</a>
<h1 class="h3">{text.form.newTitle}</h1>

{#if categories.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if categories.data === undefined}
	<div class="bg-surface-100-900 h-64 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else}
	<ProductForm categories={categories.data} {initialCategoryId} />
{/if}
