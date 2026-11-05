<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import ProductTile from '#lib/demo/ProductTile.svelte';
	import { products } from '#lib/demo/data.js';
	import { formatPaise, percentOff } from '#lib/store/format.js';

	const product = products[1];
	const off = percentOff(product.pricePaise, product.mrpPaise);
</script>

<Frame
	title="Product"
	replaces="/p/[product]"
	needs={[
		'A large square photo with a fixed ratio, so nothing jumps when it loads',
		'Name, unit, price, struck-through MRP and the % saved',
		'"Only N left" when stock is low; "Out of stock" with no control when it is zero',
		'One primary control: Add, which turns into a stepper; say why when the limit is reached',
		'A short "more in this category" row underneath'
	]}
>
	<div class="d-img big">photo</div>
	<h2 class="d-title">{product.name}</h2>
	<p class="d-muted">{product.unit}</p>
	<p class="d-row">
		<b class="price">{formatPaise(product.pricePaise)}</b>
		<s class="d-strike">{formatPaise(product.mrpPaise)}</s>
		<span class="d-pill d-pill-warn">{off}% off</span>
	</p>
	<p class="low">Only {product.stockLeft} left</p>
	<button type="button" class="d-btn d-btn-primary d-btn-block">Add to cart</button>

	<h3 class="d-sub">More in Fruits &amp; Vegetables</h3>
	<ul class="d-grid2">
		{#each [products[0], products[3]] as other (other.id)}
			<li><ProductTile product={other} /></li>
		{/each}
	</ul>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.big {
		@apply aspect-[4/3];
	}
	.price {
		@apply text-2xl;
	}
	.low {
		@apply text-warning font-semibold;
	}
</style>
