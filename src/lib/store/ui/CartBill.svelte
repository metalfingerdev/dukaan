<script lang="ts">
  import { formatPaise } from "../format.js";
  import { strings } from "../strings.js";
  import Card from "#lib/ui/Card.svelte";

  type Pricing = {
    subtotalPaise: number;
    savingsPaise: number;
    deliveryFeePaise: number;
    smallCartFeePaise: number;
    totalPaise: number;
  };

  let {
    pricing,
    freeDeliveryAbovePaise,
    minOrderPaise,
  }: {
    pricing: Pricing;
    freeDeliveryAbovePaise: number;
    minOrderPaise: number;
  } = $props();

  const toFreeDelivery = $derived(
    pricing.deliveryFeePaise > 0
      ? freeDeliveryAbovePaise - pricing.subtotalPaise
      : 0,
  );
  const belowMinimum = $derived(
    pricing.subtotalPaise > 0 && pricing.subtotalPaise < minOrderPaise,
  );
</script>

<!-- The bill, shared by the cart and the checkout page: the same numbers `placeOrder` charges -->
<Card as="section" aria-label={strings.orders.bill}>
  <dl class="bill">
    <div class="row">
      <dt>{strings.cart.itemTotal}</dt>
      <dd>{formatPaise(pricing.subtotalPaise)}</dd>
    </div>
    <div class="row">
      <dt>{strings.cart.deliveryFee}</dt>
      <dd>
        {pricing.deliveryFeePaise === 0
          ? strings.cart.free
          : formatPaise(pricing.deliveryFeePaise)}
      </dd>
    </div>
    {#if pricing.smallCartFeePaise > 0}
      <div class="row">
        <dt>{strings.cart.handlingFee}</dt>
        <dd>{formatPaise(pricing.smallCartFeePaise)}</dd>
      </div>
    {/if}
    {#if pricing.savingsPaise > 0}
      <div class="row save">
        <dt>{strings.cart.youSave}</dt>
        <dd>{formatPaise(pricing.savingsPaise)}</dd>
      </div>
    {/if}
    <div class="row total">
      <dt>{strings.cart.total}</dt>
      <dd>{formatPaise(pricing.totalPaise)}</dd>
    </div>
  </dl>
  {#if toFreeDelivery > 0}
    <p class="nudge">
      {strings.cart.addForFreeDelivery(formatPaise(toFreeDelivery))}
    </p>
  {/if}
  {#if belowMinimum}
    <p class="minimum" role="status">
      {strings.cart.minimumOrder(formatPaise(minOrderPaise))}
    </p>
  {/if}
</Card>

<style lang="postcss">
  @reference 'src/app.css';

  .bill {
    @apply flex flex-col gap-1 text-sm;
  }
  .row {
    @apply flex justify-between;
  }
  .save {
    @apply font-semibold text-success;
  }
  .total {
    @apply mt-1 border-t-2 border-border-muted pt-2 text-base font-extrabold;
  }
  .nudge {
    @apply mt-2 rounded-base bg-secondary/25 px-2 py-1 text-sm font-semibold;
  }
  .minimum {
    @apply mt-2 text-sm font-semibold text-warning;
  }
</style>
