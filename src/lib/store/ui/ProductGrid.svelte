<script lang="ts">
  import ProductCard from "./ProductCard.svelte";
  import type { PublicProduct } from "../types.js";

  let { products }: { products: PublicProduct[] } = $props();
</script>

<ul class="grid">
  {#each products as product (product._id)}
    <li><ProductCard {product} /></li>
  {/each}
</ul>

<style lang="postcss">
  @reference 'src/app.css';

  .grid {
    @apply grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4;
  }
  .grid li {
    @apply flex flex-col;
  }
</style>
