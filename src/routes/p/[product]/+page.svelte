<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import ProductGrid from "#lib/store/ui/ProductGrid.svelte";
  import AddToCart from "#lib/store/ui/AddToCart.svelte";
  import Pill from "#lib/ui/Pill.svelte";
  import { formatPaise, percentOff } from "#lib/store/format.js";
  import { productEmoji } from "#lib/store/emoji.js";
  import { strings } from "#lib/store/strings.js";

  const result = useQuery(api.store.catalog.getProduct, () => ({
    slug: page.params.product ?? "",
  }));

  const product = $derived(result.data?.product);
  const off = $derived(
    product ? percentOff(product.pricePaise, product.mrpPaise) : null,
  );
</script>

<svelte:head>
  <title>{product ? `${product.name} | ${STORE_NAME}` : STORE_NAME}</title>
</svelte:head>

<ShopPage>
  {#if result.error}
    <p class="error">{strings.common.error}</p>
  {:else if result.data === undefined}
    <!-- Same layout as the loaded page, drawn with placeholders -->
    <div class="layout" aria-busy="true" aria-label={strings.common.loading}>
      <div class="photo bone"></div>
      <div class="info">
        <h1 class="name"><span class="bone">Product name here</span></h1>
        <p class="unit"><span class="bone">500 g</span></p>
        <p class="price"><span class="bone">₹000</span></p>
        <span class="buy bone"></span>
      </div>
    </div>
  {:else if result.data === null}
    <div class="missing">
      <p>{strings.product.notFound}</p>
      <a href={resolve("/")} class="home-link">{strings.common.backHome}</a>
    </div>
  {:else if product}
    <a
      href={resolve("/c/[category]", { category: result.data.category.slug })}
      class="back">&larr; {result.data.category.name}</a
    >
    <div class="layout">
      <div class="photo">
        {#if product.imageUrl}
          <img
            src={product.imageUrl}
            alt={product.name}
            width="600"
            height="600"
          />
        {:else}
          <span class="emoji" aria-hidden="true">{productEmoji(product.name)}</span>
        {/if}
      </div>
      <div class="info">
        <h1 class="name">{product.name}</h1>
        <p class="unit">{product.unitLabel}</p>
        <p class="price">
          <b>{formatPaise(product.pricePaise)}</b>
          {#if off !== null}
            <s class="mrp">{formatPaise(product.mrpPaise)}</s>
            <Pill tone="warn">{strings.product.percentOff(off)}</Pill>
          {/if}
        </p>
        {#if !product.inStock}
          <p class="out">{strings.product.outOfStock}</p>
        {:else}
          {#if product.lowStock && product.stockLeft !== undefined}
            <p class="low">{strings.product.onlyLeft(product.stockLeft)}</p>
          {/if}
          <p class="limit">{strings.product.maxPerOrder(product.maxQuantity)}</p>
        {/if}
        <div class="buy"><AddToCart {product} /></div>
      </div>
    </div>

    {#if result.data.related.length > 0}
      <section class="related">
        <h2 class="title">{strings.product.moreInCategory}</h2>
        <ProductGrid products={result.data.related} />
      </section>
    {/if}
  {/if}
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .back {
    @apply text-sm font-semibold text-primary;
  }
  .layout {
    @apply grid gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-[minmax(0,28rem)_1fr];
  }
  .photo {
    --fill: var(--color-background);
    @apply edge-flat aspect-square w-full overflow-hidden rounded-xl bg-background;
  }
  .photo img {
    @apply size-full object-cover;
  }
  .emoji {
    @apply flex size-full items-center justify-center text-[8rem] leading-none select-none;
  }
  .info {
    @apply flex flex-col gap-2 sm:py-2;
  }
  .name {
    @apply text-2xl leading-tight font-extrabold sm:text-3xl;
  }
  .unit {
    @apply text-text-muted;
  }
  .price {
    @apply flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl;
  }
  .mrp {
    @apply text-lg text-text-muted;
  }
  .out {
    @apply font-semibold text-danger;
  }
  .low {
    @apply font-semibold text-warning;
  }
  .limit {
    @apply text-sm text-text-muted;
  }
  .buy {
    @apply mt-2 block max-w-xs;
    min-height: 2.75rem;
  }
  .related,
  .missing {
    @apply flex flex-col gap-3;
  }
  .missing {
    @apply items-start;
  }
  .title {
    @apply text-xl font-extrabold;
  }
  .home-link {
    --fill: var(--color-foreground);
    @apply edge edge-press inline-flex min-h-11 items-center rounded-lg bg-foreground px-4 font-bold;
  }
  .error {
    @apply text-sm text-danger;
  }
</style>
