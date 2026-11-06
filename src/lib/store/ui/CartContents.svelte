<script lang="ts">
  import { resolve } from "$app/paths";

  import { getCartContext } from "../cart.context.js";
  import { effectiveQuantity } from "../cart.svelte.js";
  import { formatPaise } from "../format.js";
  import { productEmoji } from "../emoji.js";
  import { strings } from "../strings.js";
  import AddToCart from "./AddToCart.svelte";
  import CartBill from "./CartBill.svelte";
  import Button from "#lib/ui/Button.svelte";

  // The cart's lines, bill and checkout button. Used by the /cart page and the cart sheet.
  let { onnavigate }: { onnavigate?: () => void } = $props();

  const cart = getCartContext();
  const pricing = $derived(cart.pricing);
  const info = $derived(cart.storeInfo);
</script>

{#if cart.isLoading}
  <!-- The same rows as the loaded cart, drawn with placeholders -->
  <ul class="lines" aria-busy="true" aria-label={strings.common.loading}>
    {#each { length: 3 } as _, i (i)}
      <li class="line" aria-hidden="true">
        <span class="thumb bone"></span>
        <span class="text">
          <b class="bone">Product name</b>
          <span class="bone unit">500 g</span>
        </span>
        <span class="bone amount">₹000</span>
      </li>
    {/each}
  </ul>
{:else if cart.lines.length === 0}
  <div class="empty">
    <span class="empty-emoji" aria-hidden="true">🛒</span>
    <p class="muted">{strings.cart.empty}</p>
    <a href={resolve("/")} class="button primary" onclick={onnavigate}>
      {strings.cart.keepShopping}
    </a>
  </div>
{:else}
  <ul class="lines">
    {#each cart.lines as line (line.productId)}
      {@const quantity = effectiveQuantity(line)}
      <li class="line">
        <span class="thumb">
          {#if line.product.imageUrl}
            <img src={line.product.imageUrl} alt="" width="64" height="64" loading="lazy" />
          {:else}
            <span class="emoji" aria-hidden="true">{productEmoji(line.product.name)}</span>
          {/if}
        </span>
        <span class="text">
          <a
            href={resolve("/p/[product]", { product: line.product.slug })}
            class="name"
            onclick={onnavigate}
          >
            {line.product.name}
          </a>
          <span class="unit">{line.product.unitLabel}</span>
          {#if quantity === 0}
            <span class="gone">{strings.cart.unavailable}</span>
          {:else if line.quantity > quantity}
            <span class="gone">{strings.cart.onlyAvailable(quantity)}</span>
          {/if}
        </span>
        <span class="side">
          {#if quantity > 0}
            <b class="amount">{formatPaise(line.product.pricePaise * quantity)}</b>
            <span class="stepper"><AddToCart product={line.product} /></span>
          {:else}
            <Button onclick={() => cart.setQuantity(line.product, 0)}>
              {strings.cart.remove}
            </Button>
          {/if}
        </span>
      </li>
    {/each}
  </ul>

  {#if pricing && info}
    <CartBill
      {pricing}
      freeDeliveryAbovePaise={info.freeDeliveryAbovePaise}
      minOrderPaise={info.minOrderPaise}
    />
  {/if}

  <!-- Checkout is private: a signed-out visitor is sent to sign in and lands back here, with
    the guest cart merged -->
  <a href={resolve("/checkout")} class="button primary" onclick={onnavigate}>
    {strings.cart.checkout}
  </a>
{/if}

<style lang="postcss">
  @reference 'src/app.css';

  .lines {
    @apply flex flex-col;
  }
  .line {
    @apply flex items-start gap-3 border-b-2 border-border-muted py-3 first:pt-0 last:border-b-0;
  }
  .thumb {
    --fill: var(--color-background);
    @apply edge-flat grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-background;
  }
  .thumb img {
    @apply size-full object-cover;
  }
  .emoji {
    @apply text-3xl leading-none select-none;
  }
  .text {
    @apply flex min-w-0 flex-1 flex-col;
  }
  .name {
    @apply font-semibold;
  }
  .unit {
    @apply text-sm text-text-muted;
  }
  .gone {
    @apply text-sm font-semibold text-danger;
  }
  .side {
    @apply flex shrink-0 flex-col items-end gap-2;
  }
  .amount {
    @apply text-lg;
  }
  .stepper {
    @apply block w-36;
  }
  .empty {
    @apply flex flex-col items-center gap-3 py-8 text-center;
  }
  .empty-emoji {
    @apply text-6xl leading-none;
  }
  .muted {
    @apply text-text-muted;
  }
  .button {
    @apply edge edge-press inline-flex min-h-12 items-center justify-center rounded-lg px-4 font-bold;
  }
  .primary {
    --fill: var(--color-primary);
    @apply bg-primary text-foreground;
  }
</style>
