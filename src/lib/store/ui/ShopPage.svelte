<script lang="ts">
  import type { Snippet } from "svelte";

  import { getCartContext } from "../cart.context.js";
  import ClosedBanner from "./ClosedBanner.svelte";
  import CartBar from "./CartBar.svelte";

  let {
    children,
    showCartBar = true,
    closedNotice = true,
  }: {
    children: Snippet;
    showCartBar?: boolean;
    /** Checkout says it in its own words, so it turns this one off */
    closedNotice?: boolean;
  } = $props();

  const cart = getCartContext();
</script>

<!-- The frame every storefront page shares: the closed-store notice, then the page (the
  search bar and delivery time are in the header, ShopHeader).
  A wrapper component rather than a route group, since a group would rename the "/" route ID
  that the rest of the app passes to resolve(). The bottom padding keeps the last row clear of
  the fixed cart bar. -->
<div class="page" class:with-bar={showCartBar && cart.count > 0}>
  {#if closedNotice}<ClosedBanner />{/if}
  {@render children()}
</div>

{#if showCartBar}
  <CartBar />
{/if}

<style lang="postcss">
  @reference 'src/app.css';

  .page {
    @apply mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-3 sm:p-4 lg:px-8;
  }
  /* Room for the bottom cart bar, which only phones get */
  .with-bar {
    @apply pb-24 md:pb-4;
  }
</style>
