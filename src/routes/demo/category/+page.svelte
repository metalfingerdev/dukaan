<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import ProductTile from '#lib/demo/ProductTile.svelte';
	import { products } from '#lib/demo/data.js';
</script>

<Frame
	title="Category"
	replaces="/c/[category]"
	needs={[
		'Category name with a way back to all categories',
		'Sort (price low to high, high to low, A to Z) and an "in stock only" switch, reachable with one thumb',
		'Same product tile as the home shelf, so one design serves both',
		'Out-of-stock items stay visible but have no Add button',
		'Skeleton tiles while loading; a friendly empty state when nothing matches'
	]}
>
	<a href="/demo/home" class="d-muted">&larr; All categories</a>
	<h2 class="d-title">Fruits &amp; Vegetables</h2>
	<div class="d-row">
		<button type="button" class="d-btn d-btn-sm">Sort: Popular</button>
		<label class="d-row"><input type="checkbox" /> In stock only</label>
	</div>
	<ul class="d-grid2">
		{#each products as product (product.id)}
			<li><ProductTile {product} /></li>
		{/each}
	</ul>
</Frame>
