<script lang="ts">
  import { resolve } from "$app/paths";

  import { getCartContext } from "../cart.context.js";
  import { formatPaise } from "../format.js";
  import { strings } from "../strings.js";
  import { cartDrawer } from "../cartDrawer.svelte.js";

  const cart = getCartContext();
</script>

{#if cart.count > 0}
  <!-- Fixed to the bottom of a phone screen; ShopPage pads the page by the same height. From md
  up the header's cart button replaces it -->
  <a
    href={resolve("/cart")}
    class="bar"
    onclick={(event) => {
      event.preventDefault();
      cartDrawer.open = true;
    }}
  >
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
    @apply edge edge-press fixed inset-x-3 bottom-3 z-10 mx-auto flex min-h-14 max-w-screen-2xl items-center justify-between rounded-xl bg-primary px-4 py-2 font-bold text-foreground md:hidden;
  }
</style>
