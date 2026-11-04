<script lang="ts">
	// Access is checked by ../../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';

	import ProductForm from '#lib/store/admin/ProductForm.svelte';
	import { strings } from '#lib/store/strings.js';

	const product = useQuery(api.store.admin.products.getProduct, () => ({
		productId: page.params.id ?? ''
	}));
	const categories = useQuery(api.store.admin.categories.listCategories, {});
	const text = strings.admin.products;
</script>

<svelte:head>
	<title>{text.form.editTitle} | {strings.admin.title}</title>
</svelte:head>

<a href={resolve('/admin/products')} class="text-primary-600-400 text-sm">&larr; {text.form.back}</a>
<h1 class="h3">{text.form.editTitle}</h1>

{#if product.error || categories.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if product.data === undefined || categories.data === undefined}
	<div class="bg-surface-100-900 h-64 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if product.data === null}
	<p class="text-sm">{text.form.notFound}</p>
{:else}
	<!-- Keyed on the id: the form is filled once from its props, so another product needs a new one -->
	{#key product.data._id}
		<ProductForm categories={categories.data} product={product.data} />
	{/key}
{/if}
