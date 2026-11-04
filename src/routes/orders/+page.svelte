<script lang="ts">
  import { resolve } from "$app/paths";
  import { usePaginatedQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import { STORE_NAME } from "#convex/model/store/storeProfile.js";

  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import Card from "#lib/ui/Card.svelte";
  import Pill from "#lib/ui/Pill.svelte";
  import Button from "#lib/ui/Button.svelte";
  import { formatDateTime, formatPaise } from "#lib/store/format.js";
  import { strings } from "#lib/store/strings.js";
  import { useRequireSignIn } from "#lib/store/requireSignIn.svelte.js";

  const auth = useRequireSignIn();

  // Private page; `listMyOrders` only ever returns the signed-in customer's own orders
  const orders = usePaginatedQuery(
    api.store.orders.listMyOrders,
    () => (auth.isAuthenticated ? {} : "skip"),
    { initialNumItems: 10 },
  );

  const tone = (status: string) =>
    status === "delivered"
      ? "ok"
      : status === "cancelled" || status === "delivery_failed"
        ? "bad"
        : "warn";
</script>

<svelte:head>
  <title>{strings.orders.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage>
  <h1 class="title">{strings.orders.title}</h1>

  <div class="list">
    {#if orders.error}
      <p class="error">{strings.common.error}</p>
    {:else if orders.status === "LoadingFirstPage"}
      <!-- The same rows as the loaded list, drawn with placeholders -->
      <ul class="rows" aria-busy="true" aria-label={strings.common.loading}>
        {#each { length: 3 } as _, i (i)}
          <li aria-hidden="true">
            <Card>
              <span class="row">
                <span class="info">
                  <b class="bone">Order #0000</b>
                  <span class="bone small">3 Nov, 6:02 pm</span>
                </span>
                <span class="end">
                  <b class="bone">₹000</b>
                  <span class="bone small">Delivered</span>
                </span>
              </span>
            </Card>
          </li>
        {/each}
      </ul>
    {:else if orders.results.length === 0}
      <div class="empty">
        <span class="emoji" aria-hidden="true">📦</span>
        <p class="muted">{strings.orders.empty}</p>
        <Button href={resolve("/")} variant="primary">
          {strings.orders.startShopping}
        </Button>
      </div>
    {:else}
      <ul class="rows">
        {#each orders.results as order (order._id)}
          <li>
            <Card as="a" pressable href={resolve("/orders/[id]", { id: order._id })}>
              <span class="row">
                <span class="info">
                  <b>{strings.orders.orderNumber(order.orderNumber)}</b>
                  <span class="small">{formatDateTime(order.placedAt)}</span>
                </span>
                <span class="end">
                  <b>{formatPaise(order.totalPaise)}</b>
                  <Pill tone={tone(order.status)}>
                    {strings.orders.status[order.status]}
                  </Pill>
                </span>
              </span>
            </Card>
          </li>
        {/each}
      </ul>
      {#if orders.status === "CanLoadMore" || orders.status === "LoadingMore"}
        <Button
          disabled={orders.status === "LoadingMore"}
          onclick={() => orders.loadMore(10)}
        >
          {strings.orders.loadMore}
        </Button>
      {/if}
    {/if}
  </div>
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .title {
    @apply text-2xl font-extrabold;
  }
  /* Readable width on a wide screen */
  .list {
    @apply flex w-full max-w-2xl flex-col items-start gap-3;
  }
  .rows {
    @apply flex w-full flex-col gap-3;
  }
  .row {
    @apply flex min-h-11 items-center justify-between gap-3;
  }
  .info,
  .end {
    @apply flex flex-col;
  }
  .end {
    @apply items-end gap-1;
  }
  .small {
    @apply text-sm text-text-muted;
  }
  .empty {
    @apply flex flex-col items-start gap-3;
  }
  .emoji {
    @apply text-6xl leading-none;
  }
  .muted {
    @apply text-text-muted;
  }
  .error {
    @apply text-sm text-danger;
  }
</style>
