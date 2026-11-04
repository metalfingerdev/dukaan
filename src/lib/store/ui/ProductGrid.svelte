<script lang="ts">
  import ProductCard from "./ProductCard.svelte";
  import type { PublicProduct } from "../types.js";

  // `products` undefined means loading: the same grid fills with skeleton cards
  let {
    products,
    loadingCount = 8,
  }: { products: PublicProduct[] | undefined; loadingCount?: number } =
    $props();
</script>

{#if products}
  <ul class="grid">
    {#each products as product (product._id)}
      <li><ProductCard {product} /></li>
    {/each}
  </ul>
{:else}
  <ul class="grid" aria-busy="true" aria-label="Loading">
    {#each { length: loadingCount } as _, i (i)}
      <li><ProductCard /></li>
    {/each}
  </ul>
{/if}

<style lang="postcss">
  @reference 'src/app.css';

  .grid {
    @apply grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5;
  }
  .grid li {
    @apply flex flex-col;
  }
</style>
