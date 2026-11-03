<script lang="ts">
	import ProductCard from './ProductCard.svelte';
	import type { PublicProduct } from '../types.js';

	let { products }: { products: PublicProduct[] } = $props();
</script>

<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
	{#each products as product (product._id)}
		<li class="flex flex-col"><ProductCard {product} /></li>
	{/each}
</ul>
