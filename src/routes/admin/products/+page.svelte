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
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';
	import { productEmoji } from '#lib/store/emoji.js';

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
			replace: true
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

<div class="head">
	<h1 class="title">{text.title}</h1>
	<div class="row">
		<Button href={resolve('/admin/products/import')}>{text.importLink}</Button>
		<Button href={addHref} variant="primary">{text.add}</Button>
	</div>
</div>

<div class="row" role="group" aria-label={text.title}>
	{#each ['all', 'low', 'out'] as const as option (option)}
		<button
			type="button"
			class="filter"
			class:on={filter === option}
			aria-pressed={filter === option}
			onclick={() => setParam('filter', option === 'all' ? '' : option)}
		>
			{text.filters[option]}
		</button>
	{/each}
</div>

{#if filter === 'all'}
	<div class="finders">
		<Field label={text.category}>
			<select value={categoryId ?? ''} onchange={(e) => setCategory(e.currentTarget.value)}>
				<option value="">{text.allCategories}</option>
				{#each categories.data ?? [] as category (category._id)}
					<option value={category._id}>
						{category.name}{category.isActive ? '' : ` (${text.hidden})`}
					</option>
				{/each}
			</select>
		</Field>
		<Field label={text.search}>
			<input type="search" bind:value={search} autocomplete="off" />
		</Field>
	</div>
{/if}

{#if products.error}
	<p class="problem">{strings.common.error}</p>
{:else if products.data === undefined}
	<!-- The same rows as the loaded list, drawn with placeholders -->
	<ul class="rows" aria-busy="true" aria-label={strings.common.loading}>
		{#each { length: 5 } as _, i (i)}
			<li aria-hidden="true">
				<Card dense>
					<div class="line">
						<span class="thumb bone"></span>
						<span class="info">
							<b class="bone">Product name here</b>
							<span class="bone small">1 kg · ₹000</span>
						</span>
					</div>
				</Card>
			</li>
		{/each}
	</ul>
{:else if products.data.length === 0}
	<p class="muted">{text.empty}</p>
{:else}
	<ul class="rows">
		{#each products.data as product (product._id)}
			<li>
				<Card dense>
					<div class="item">
						<div class="line">
							<a href={resolve('/admin/products/[id]', { id: product._id })} class="main">
								<span class="thumb">
									{#if product.imageUrl}
										<img src={product.imageUrl} alt="" width="56" height="56" loading="lazy" />
									{:else}
										<span class="emoji" aria-hidden="true">{productEmoji(product.name)}</span>
									{/if}
								</span>
								<span class="info">
									<b class="name">{product.name}</b>
									<span class="small">{product.unitLabel} · {formatPaise(product.pricePaise)}</span>
									<span class="flags">
										<span class:out={product.stock === 0}>
											{product.stock === 0 ? text.outOfStock : text.inStock(product.stock)}
										</span>
										{#if !product.imageUrl}<span class="warn">{text.noPhoto}</span>{/if}
										{#if !product.isActive}<span class="warn">{text.hidden}</span>{/if}
										{#if hiddenCategories.has(product.categoryId)}
											<span class="warn">{text.hiddenCategory}</span>
										{/if}
										{#if product.isFeatured}<span>{text.featured}</span>{/if}
									</span>
								</span>
							</a>
							<Button
								aria-expanded={openStockId === product._id}
								aria-label="{openStockId === product._id ? text.stock.close : text.stock.open}: {product.name}"
								onclick={() => (openStockId = openStockId === product._id ? null : product._id)}
							>
								{openStockId === product._id ? text.stock.close : text.stock.open}
							</Button>
						</div>
						{#if openStockId === product._id}
							<StockPanel productId={product._id} stock={product.stock} />
						{/if}
					</div>
				</Card>
			</li>
		{/each}
	</ul>
	{#if products.data.length >= 200}
		<p class="muted">{text.limited(200)}</p>
	{/if}
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.head {
		@apply flex flex-wrap items-center justify-between gap-3;
	}
	.title {
		@apply text-2xl font-extrabold;
	}
	.row {
		@apply flex flex-wrap gap-2;
	}
	.filter {
		--fill: var(--color-foreground);
		@apply edge-flat min-h-11 rounded-full bg-foreground px-4 font-bold;
	}
	.filter.on {
		--fill: var(--color-primary);
		@apply bg-primary text-foreground;
	}
	.finders {
		@apply grid gap-3 sm:grid-cols-2;
	}
	.rows {
		@apply grid grid-cols-[minmax(0,1fr)] gap-2 xl:grid-cols-[repeat(2,minmax(0,1fr))];
	}
	.item {
		@apply flex flex-col gap-3;
	}
	.line {
		@apply flex items-center gap-3;
	}
	.main {
		@apply flex min-w-0 flex-1 items-center gap-3;
	}
	.thumb {
		--fill: var(--color-background);
		@apply edge-flat grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-background;
	}
	.thumb img {
		@apply size-full object-cover;
	}
	.emoji {
		@apply text-2xl leading-none;
	}
	.info {
		@apply flex min-w-0 flex-1 flex-col;
	}
	.name {
		@apply truncate;
	}
	.small {
		@apply text-sm text-text-muted;
	}
	.flags {
		@apply flex flex-wrap gap-x-3 text-xs;
	}
	.out {
		@apply font-bold text-danger;
	}
	.warn {
		@apply font-semibold text-warning;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
</style>
