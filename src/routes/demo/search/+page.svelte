<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import ProductTile from '#lib/demo/ProductTile.svelte';
	import { products } from '#lib/demo/data.js';
</script>

<Frame
	title="Search"
	replaces="/search?q="
	needs={[
		'The search box stays focused and results follow what is typed',
		'Result tiles identical to the category grid',
		'A clear "nothing found" state with a way to browse categories instead',
		'Works on a slow connection: show skeleton tiles, keep the old results until new ones arrive'
	]}
>
	<input class="d-input" value="mil" aria-label="Search" />
	<p class="d-muted">2 results for "mil"</p>
	<ul class="d-grid2">
		{#each [products[2], products[6]] as product (product.id)}
			<li><ProductTile {product} /></li>
		{/each}
	</ul>

	<h3 class="d-sub">No results state</h3>
	<div class="d-card-flat empty">
		<p><b>Nothing found for "xyz"</b></p>
		<p class="d-muted">Check the spelling, or browse by category.</p>
		<a href="/demo/home" class="d-btn">Browse categories</a>
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.empty {
		@apply flex flex-col items-start gap-2;
	}
</style>
