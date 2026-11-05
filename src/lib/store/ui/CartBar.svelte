<script lang="ts">
  import { resolve } from "$app/paths";

  import { getCartContext } from "../cart.context.js";
  import { formatPaise } from "../format.js";
  import { strings } from "../strings.js";

  const cart = getCartContext();
</script>

{#if cart.count > 0}
  <!-- Fixed to the bottom of the screen; ShopPage pads the page by the same height -->
  <a href={resolve("/cart")} class="bar">
    <span>
      {strings.cart.items(cart.count)}{#if cart.pricing}
        &middot; {formatPaise(cart.pricing.subtotalPaise)}{/if}
    </span>
    <span>{strings.cart.viewCart} &rarr;</span>
  </a>
{/if}

<style lang="postcss">
  @reference 'src/app.css';

  .bar {
    --fill: var(--color-primary);
    @apply edge edge-press fixed inset-x-3 bottom-3 z-10 mx-auto flex min-h-14 max-w-5xl items-center justify-between rounded-container bg-primary px-4 py-2 font-bold text-foreground;
  }
</style>
