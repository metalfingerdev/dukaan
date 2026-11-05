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

<a href={resolve('/admin/products')} class="back">&larr; {text.form.back}</a>
<h1 class="title">{text.form.editTitle}</h1>

{#if product.error || categories.error}
	<p class="problem">{strings.common.error}</p>
{:else if product.data === undefined || categories.data === undefined}
	<div class="bone loading" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if product.data === null}
	<p class="muted">{text.form.notFound}</p>
{:else}
	<!-- Keyed on the id: the form is filled once from its props, so another product needs a new one -->
	{#key product.data._id}
		<ProductForm categories={categories.data} product={product.data} />
	{/key}
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.back {
		@apply text-sm font-semibold text-primary;
	}
	.title {
		@apply text-2xl font-extrabold;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.muted {
		@apply text-sm;
	}
	.loading {
		@apply block h-64 w-full;
	}
</style>
