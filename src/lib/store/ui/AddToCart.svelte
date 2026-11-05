<script lang="ts">
  import { getCartContext } from "../cart.context.js";
  import { strings } from "../strings.js";
  import type { PublicProduct } from "../types.js";
  import Button from "#lib/ui/Button.svelte";

  let { product }: { product: PublicProduct } = $props();

  const cart = getCartContext();
  const quantity = $derived(cart.quantityOf(product._id));
  const atMax = $derived(quantity > 0 && quantity >= product.maxQuantity);

  let busy = $state(false);
  let note = $state("");

  const change = async (next: number) => {
    busy = true;
    note = "";
    const status = await cart.setQuantity(product, next);
    if (status === "clamped")
      note = strings.cart.onlyAvailable(product.maxQuantity);
    else if (status === "out_of_stock" || status === "unavailable")
      note = strings.cart.unavailable;
    else if (status === "error") note = strings.common.error;
    busy = false;
  };
</script>

{#if product.inStock && product.maxQuantity > 0}
  {#if quantity === 0}
    <Button variant="primary" block disabled={busy} onclick={() => change(1)}>
      {strings.product.add}
    </Button>
  {:else}
    <div class="stepper">
      <Button
        variant="accent"
        icon
        aria-label={strings.cart.removeOne}
        disabled={busy}
        onclick={() => change(quantity - 1)}>&minus;</Button
      >
      <span class="quantity" aria-live="polite">{quantity}</span>
      <Button
        variant="primary"
        icon
        aria-label={strings.cart.addOne}
        disabled={busy || atMax}
        onclick={() => change(quantity + 1)}>+</Button
      >
    </div>
    {#if atMax && !note}
      <p class="note">{strings.cart.maxReached(product.maxQuantity)}</p>
    {/if}
  {/if}
  {#if note}
    <p class="note warning" role="status">{note}</p>
  {/if}
{/if}

<style lang="postcss">
  @reference 'src/app.css';

  .stepper {
    @apply flex items-center justify-between gap-2;
  }
  .quantity {
    @apply min-w-8 text-center text-lg font-extrabold;
  }
  .note {
    @apply text-center text-xs text-text-muted;
  }
  .warning {
    @apply text-warning;
  }
</style>
