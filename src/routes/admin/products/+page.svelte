<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { gotoApp } from '#lib/primitives/utils/navigation.js';
	import { formatPaise } from '#lib/store/format.js';
	import StockPanel from '#lib/store/admin/StockPanel.svelte';
	import { strings } from '#lib/store/strings.js';

	const text = strings.admin.products;
	const categories = useQuery(api.store.admin.categories.listCategories, {});

	// The category lives in the URL, so a refresh or the back button keeps the list
	const categoryId = $derived((page.url.searchParams.get('category') || undefined) as Id<'categories'> | undefined);
	let search = $state(page.url.searchParams.get('q') ?? '');

	// All, low stock or out of stock. The low and out lists cover every category and ignore the
	// category and search boxes, which are hidden while one of them is shown.
	type Filter = 'all' | 'low' | 'out';
	const filter = $derived<Filter>(
		page.url.searchParams.get('filter') === 'low'
			? 'low'
			: page.url.searchParams.get('filter') === 'out'
				? 'out'
				: 'all'
	);

	const listed = useQuery(api.store.admin.products.listProducts, () =>
		filter === 'all' ? { categoryId, search: search.trim() || undefined } : 'skip'
	);
	const low = useQuery(api.store.admin.stock.listLowStock, () => (filter === 'low' ? {} : 'skip'));
	const out = useQuery(api.store.admin.stock.listOutOfStock, () => (filter === 'out' ? {} : 'skip'));
	const products = $derived(filter === 'low' ? low : filter === 'out' ? out : listed);

	// Which row has its stock panel open
	let openStockId = $state<Id<'products'> | null>(null);

	const setParam = (name: string, value: string) => {
		const params = new URLSearchParams(page.url.search);
		if (value) params.set(name, value);
		else params.delete(name);
		void gotoApp(`${resolve('/admin/products')}${params.size ? `?${params}` : ''}`, {
			replaceState: true
		});
	};

	const setCategory = (value: string) => setParam('category', value);

	const hiddenCategories = $derived(
		new Set((categories.data ?? []).filter((c) => !c.isActive).map((c) => c._id))
	);
	const addHref = $derived(
		`${resolve('/admin/products/new')}${categoryId ? `?category=${categoryId}` : ''}`
	);
</script>

<svelte:head>
	<title>{text.title} | {strings.admin.title}</title>
</svelte:head>

<div class="flex items-center justify-between gap-3">
	<h1 class="h3">{text.title}</h1>
	<div class="flex gap-2">
		<a href={resolve('/admin/products/import')} class="btn preset-tonal min-h-11">{text.importLink}</a>
		<a href={addHref} class="btn preset-filled-primary-500 min-h-11">{text.add}</a>
	</div>
</div>

<div class="flex gap-2" role="group" aria-label={text.title}>
	{#each ['all', 'low', 'out'] as const as option (option)}
		<button
			type="button"
			class="btn min-h-11 {filter === option ? 'preset-filled-primary-500' : 'preset-tonal'}"
			aria-pressed={filter === option}
			onclick={() => setParam('filter', option === 'all' ? '' : option)}
		>
			{text.filters[option]}
		</button>
	{/each}
</div>

{#if filter === 'all'}
<div class="grid gap-3 sm:grid-cols-2">
	<label class="label">
		<span class="label-text">{text.category}</span>
		<select class="select" value={categoryId ?? ''} onchange={(e) => setCategory(e.currentTarget.value)}>
			<option value="">{text.allCategories}</option>
			{#each categories.data ?? [] as category (category._id)}
				<option value={category._id}>
					{category.name}{category.isActive ? '' : ` (${text.hidden})`}
				</option>
			{/each}
		</select>
	</label>
	<label class="label">
		<span class="label-text">{text.search}</span>
		<input class="input" type="search" bind:value={search} autocomplete="off" />
	</label>
</div>
{/if}

{#if products.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if products.data === undefined}
	<div class="bg-surface-100-900 h-64 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if products.data.length === 0}
	<p class="text-surface-600-400 text-sm">{text.empty}</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each products.data as product (product._id)}
			<li class="card preset-outlined-surface-300-700 flex flex-col gap-3 p-3">
				<div class="flex items-center gap-3">
				<a
					href={resolve('/admin/products/[id]', { id: product._id })}
					class="flex min-w-0 flex-1 items-center gap-3"
				>
					<div
						class="bg-surface-100-900 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded text-[10px]"
					>
						{#if product.imageUrl}
							<img src={product.imageUrl} alt="" class="size-full object-cover" width="56" height="56" loading="lazy" />
						{:else}
							<span class="text-surface-600-400">{text.noPhoto}</span>
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="truncate font-semibold">{product.name}</div>
						<div class="text-surface-600-400 text-sm">
							{product.unitLabel} · {formatPaise(product.pricePaise)}
						</div>
						<div class="flex flex-wrap gap-x-3 text-xs">
							<span class={product.stock === 0 ? 'text-error-600-400' : ''}>
								{product.stock === 0 ? text.outOfStock : text.inStock(product.stock)}
							</span>
							{#if !product.isActive}<span class="text-warning-700-300">{text.hidden}</span>{/if}
							{#if hiddenCategories.has(product.categoryId)}
								<span class="text-warning-700-300">{text.hiddenCategory}</span>
							{/if}
							{#if product.isFeatured}<span>{text.featured}</span>{/if}
						</div>
					</div>
				</a>
				<button
					type="button"
					class="btn preset-tonal min-h-11 shrink-0"
					aria-expanded={openStockId === product._id}
					aria-label="{openStockId === product._id ? text.stock.close : text.stock.open}: {product.name}"
					onclick={() => (openStockId = openStockId === product._id ? null : product._id)}
				>
					{openStockId === product._id ? text.stock.close : text.stock.open}
				</button>
				</div>
				{#if openStockId === product._id}
					<StockPanel productId={product._id} stock={product.stock} />
				{/if}
			</li>
		{/each}
	</ul>
	{#if products.data.length >= 200}
		<p class="text-surface-600-400 text-sm">{text.limited(200)}</p>
	{/if}
{/if}
