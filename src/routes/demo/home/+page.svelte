<script lang="ts">
  import Frame from "#lib/demo/Frame.svelte";
  import ProductTile from "#lib/demo/ProductTile.svelte";
  import { categories, products } from "#lib/demo/data.js";
  import { formatPaise } from "#lib/store/format.js";
</script>

<Frame
  title="Home"
  replaces="/ (src/routes/+page.svelte)"
  needs={[
    "Say at a glance whether the store is open and how long delivery takes",
    "Offer search first; most customers know what they want",
    "Category grid with a photo and a name; two columns on a phone",
    "A shelf of popular products, each with Add / stepper right on the card",
    "A cart bar stuck to the bottom once the cart has items; never cover the last row",
    'Show a skeleton while loading, and a quiet "closed right now" banner (browsing still works)',
  ]}
>
  <div class="row">
    <span class="pill pill-ok">Open</span>
    <span>Delivery in ~30 min</span>
  </div>
  <input
    class="searchbar input"
    placeholder="Search for products"
    aria-label="Search"
  />

  <h2 class="title">Shop by category</h2>
  <ul class="grid2">
    {#each categories as category (category.slug)}
      <li class="card category">
        <span class="img thumb">photo</span>
        <b>{category.name}</b>
      </li>
    {/each}
  </ul>

  <h2 class="title">Popular right now</h2>
  <ul class="grid2">
    {#each products.slice(0, 4) as product, i (product.id)}
      <li><ProductTile {product} quantity={i === 1 ? 2 : 0} /></li>
    {/each}
  </ul>

  <a href="/demo/cart" class="bar">
    <span>3 items &middot; {formatPaise(3800 * 2 + 2900)}</span>
    <span>View cart &rarr;</span>
  </a>
</Frame>

<style lang="postcss">
  @reference 'src/app.css';

  .row {
    @apply flex flex-wrap items-center gap-2;
  }
  .grid2 {
    @apply grid grid-cols-2 gap-3;
  }
  .title {
    @apply text-xl font-extrabold;
  }
  .card {
    --fill: var(--color-foreground);
    @apply edge rounded-container bg-foreground p-3;
  }
  .img {
    @apply flex aspect-square w-full items-center justify-center overflow-hidden rounded-base edge-flat bg-secondary/10 text-xs;
  }
  .pill {
    @apply inline-flex items-center rounded-full edge-flat px-2 text-xs font-bold;
  }
  .pill-ok {
    --fill: var(--color-primary);
    @apply bg-primary text-foreground;
  }
  .bar {
    --fill: var(--color-primary);
    @apply edge edge-press sticky bottom-3 flex min-h-14 items-center justify-between rounded-container bg-primary px-4 py-2 font-bold text-foreground;
  }
  .input {
    --fill: var(--color-foreground);
    @apply edge min-h-11 w-full rounded-base bg-foreground px-3;
  }

  .searchbar {
    @apply sticky top-0;
  }
  .category {
    @apply flex items-center gap-3;
  }
  .thumb {
    @apply size-12 shrink-0;
  }
</style>
