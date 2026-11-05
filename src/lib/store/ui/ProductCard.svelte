<script lang="ts">
  import { resolve } from "$app/paths";

  import { formatPaise, percentOff } from "../format.js";
  import { strings } from "../strings.js";
  import type { PublicProduct } from "../types.js";
  import AddToCart from "./AddToCart.svelte";
  import Card from "#lib/ui/Card.svelte";
  import Pill from "#lib/ui/Pill.svelte";

  let { product }: { product: PublicProduct } = $props();

  const off = $derived(percentOff(product.pricePaise, product.mrpPaise));
</script>

<!-- The card is not one big link: a button inside a link is invalid and hard to tap. The link
  covers the picture and text; the cart control sits below it. -->
<Card>
  <div class="product">
    <a
      href={resolve("/p/[product]", { product: product.slug })}
      class="details"
    >
      <!-- Fixed aspect ratio so the grid doesn't jump when images arrive -->
      <div class="photo">
        {#if product.imageUrl}
          <img
            src={product.imageUrl}
            alt=""
            width="300"
            height="300"
            loading="lazy"
          />
        {/if}
      </div>
      <h3 class="name">{product.name}</h3>
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
      {:else if product.lowStock && product.stockLeft !== undefined}
        <p class="low">{strings.product.onlyLeft(product.stockLeft)}</p>
      {/if}
    </a>
    <AddToCart {product} />
  </div>
</Card>

<style lang="postcss">
  @reference 'src/app.css';

  .product {
    @apply flex h-full flex-col gap-2;
  }
  .details {
    @apply flex flex-1 flex-col gap-1;
  }
  .photo {
    --fill: var(--color-background);
    @apply edge-flat aspect-square w-full overflow-hidden rounded-base bg-background;
  }
  .photo img {
    @apply size-full object-cover;
  }
  .name {
    @apply line-clamp-2 min-h-[2lh] leading-snug font-semibold;
  }
  .unit {
    @apply text-sm text-text-muted;
  }
  .price {
    @apply flex flex-wrap items-baseline gap-x-2 text-lg;
  }
  .mrp {
    @apply text-sm text-text-muted;
  }
  .out {
    @apply text-sm font-semibold text-danger;
  }
  .low {
    @apply text-sm font-semibold text-warning;
  }
</style>
