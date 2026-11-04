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

  /* Fluid: as many columns as fit, from two on a small phone to seven or eight on a wide
     screen, so tablets and big monitors use their width */
  .grid {
    --card-min: 9.5rem;
    @apply grid gap-3;
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  }
  @media (min-width: 768px) {
    .grid {
      --card-min: 11rem;
    }
  }
  /* Every card in a row is as tall as the tallest */
  .grid li {
    @apply flex flex-col;
  }
  .grid li > :global(.card) {
    @apply flex-1;
  }
</style>
