<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import PhoneIcon from "@lucide/svelte/icons/phone";
  import { useConvexClient, useQuery } from "convex-svelte";
  import { api } from "#convex/_generated/api.js";
  import {
    SLOT_MINUTES,
    STORE_NAME,
  } from "#convex/model/store/storeProfile.js";

  import PayOnline from "#lib/store/ui/PayOnline.svelte";
  import UpiQrPay from "#lib/store/ui/UpiQrPay.svelte";
  import SendLocation from "#lib/store/ui/SendLocation.svelte";
  import ShopPage from "#lib/store/ui/ShopPage.svelte";
  import Button from "#lib/ui/Button.svelte";
  import Card from "#lib/ui/Card.svelte";
  import Pill from "#lib/ui/Pill.svelte";
  import Notice from "#lib/ui/Notice.svelte";
  import ConfirmDialog from "#lib/ui/ConfirmDialog.svelte";
  import { getCartContext } from "#lib/store/cart.context.js";
  import {
    formatDateTime,
    formatPaise,
    formatSlot,
  } from "#lib/store/format.js";
  import { strings } from "#lib/store/strings.js";
  import { useRequireSignIn } from "#lib/store/requireSignIn.svelte.js";

  const auth = useRequireSignIn();
  const client = useConvexClient();
  const cart = getCartContext();

  // Live: the timeline moves on its own as the store works the order. `getOrder` returns `null`
  // for an unknown id and for someone else's order alike.
  const result = useQuery(api.store.orders.getOrder, () =>
    auth.isAuthenticated ? { orderId: page.params.id ?? "" } : "skip",
  );
  const order = $derived(result.data);
  const justPlaced = $derived(page.url.searchParams.get("placed") === "1");
  const storePhone = $derived(cart.storeInfo?.storePhone);

  let cancelling = $state(false);
  let cancelFailed = $state(false);
  let confirmingCancel = $state(false);

  const cancel = async () => {
    if (!order) return;
    cancelling = true;
    cancelFailed = false;
    try {
      await client.mutation(api.store.orders.cancelOrder, {
        orderId: order._id,
      });
    } catch {
      cancelFailed = true;
    } finally {
      cancelling = false;
    }
  };

  const statusTone = (status: string) =>
    status === "delivered"
      ? "ok"
      : status === "cancelled" || status === "delivery_failed"
        ? "bad"
        : "warn";
</script>

<svelte:head>
  <title>
    {order ? strings.orders.orderNumber(order.orderNumber) : strings.orders.title}
    | {STORE_NAME}
  </title>
</svelte:head>

<ShopPage>
  <a href={resolve("/orders")} class="back"
    >&larr; {strings.orders.backToOrders}</a
  >

  {#if result.error}
    <p class="problem">{strings.common.error}</p>
  {:else if result.data === undefined}
    <!-- The same blocks as the loaded page, drawn with placeholders -->
    <div class="page" aria-busy="true" aria-label={strings.common.loading}>
      <h1 class="title"><span class="bone">Order #0000</span></h1>
      <span class="block bone"></span>
      <span class="block bone"></span>
    </div>
  {:else if !order}
    <div class="missing">
      <p>{strings.orders.notFound}</p>
      <Button href={resolve("/orders")}>{strings.orders.backToOrders}</Button>
    </div>
  {:else}
    <div class="page">
      {#if justPlaced && order.status === "placed" && order.paymentMethod !== "online"}
        <Notice tone="info" role="status">{strings.orders.placedBanner}</Notice>
      {/if}

      <header class="head">
        <div>
          <h1 class="title">{strings.orders.orderNumber(order.orderNumber)}</h1>
          <p class="small">{formatDateTime(order.placedAt)}</p>
        </div>
        <Pill tone={statusTone(order.status)}>
          {strings.orders.status[order.status]}
        </Pill>
      </header>

      {#if order.status === "awaiting_payment" && order.onlinePayment}
        <PayOnline
          orderId={order._id}
          orderNumber={order.orderNumber}
          payment={order.onlinePayment}
          contact={{
            name: order.address.contactName,
            phone: order.address.contactPhone,
          }}
          openAtOnce={justPlaced}
        />
      {:else if justPlaced && order.paymentMethod === "online" && order.paymentStatus === "paid" && order.status === "placed"}
        <Notice tone="info" role="status">{strings.payOnline.paid}</Notice>
      {/if}

      {#if order.refundStatus}
        <Notice tone="warn" role="status">
          {strings.payOnline.refund[order.refundStatus]}
        </Notice>
      {/if}

      {#if order.deliveryCode}
        <section class="code">
          <p class="strong">{strings.orders.codeTitle}</p>
          <p class="digits" aria-label={strings.orders.codeLabel}>
            {order.deliveryCode}
          </p>
          <p class="small">
            {order.status === "out_for_delivery"
              ? strings.orders.codeOnTheWay
              : strings.orders.codeKeep}
          </p>
        </section>
      {/if}

      {#if order.status === "out_for_delivery" && (order.paymentStatus === "pending" || order.upiQr?.status === "paid")}
        <UpiQrPay
          qr={order.upiQr}
          amountPaise={order.totalPaise}
          forRider={false}
          request={() =>
            client.mutation(api.store.upi.requestQrAsCustomer, {
              orderId: order._id,
            })}
          check={() =>
            client.mutation(api.store.upi.checkPaymentAsCustomer, {
              orderId: order._id,
            })}
        />
      {/if}

      {#if order.partner}
        <!-- Only while the order is on the way: the number is not kept on old orders -->
        <Button
          href={`tel:${order.partner.phoneNumber}`}
          variant="success"
          large
          block
        >
          <PhoneIcon class="size-5" aria-hidden="true" />
          {strings.orders.callPartner(order.partner.name)}
        </Button>
      {/if}

      {#if order.status === "out_for_delivery" || order.status === "delivery_failed" || order.status === "packed"}
        <SendLocation orderId={order._id} />
      {/if}

      {#if order.status === "cancelled"}
        <p class="muted">{strings.orders.cancelledNote}</p>
      {/if}

      {#if order.invoiceNumber}
        <Button href={resolve("/orders/[id]/invoice", { id: order._id })}>
          {strings.orders.viewInvoice} · {order.invoiceNumber}
        </Button>
      {/if}

      <div class="columns">
        <div class="column">
          <section class="section">
            <h2 class="heading">{strings.orders.timeline}</h2>
            <ol class="timeline">
              {#each order.events as event, index (event.at + event.status)}
                <li class:latest={index === order.events.length - 1}>
                  <span class="dot" aria-hidden="true"></span>
                  <span class="what">
                    <b>{strings.orders.status[event.status]}</b>
                    {#if event.note}<span class="small">{event.note}</span>{/if}
                  </span>
                  <span class="small when">{formatDateTime(event.at)}</span>
                </li>
              {/each}
            </ol>
          </section>

          <section class="section">
            <h2 class="heading">{strings.orders.deliveringTo}</h2>
            <Card>
              <div class="address">
                <p>
                  <b>{order.address.contactName}</b>, {order.address.contactPhone}
                </p>
                <p>{order.address.line1}</p>
                <p class="small">
                  {order.address.area}{#if order.address.landmark}
                    &middot; {order.address.landmark}{/if}
                </p>
                <p>
                  <span class="small">{strings.orders.deliveryTime}:</span>
                  {order.slotStartMs === undefined
                    ? strings.orders.asap
                    : formatSlot(order.slotStartMs, SLOT_MINUTES)}
                </p>
                {#if order.customerNote}
                  <p>
                    <span class="small">{strings.orders.note}:</span>
                    {order.customerNote}
                  </p>
                {/if}
              </div>
            </Card>
          </section>
        </div>

        <div class="column">
          <section class="section">
            <h2 class="heading">{strings.orders.items}</h2>
            <ul class="items">
              {#each order.items as item (item.name + item.unitLabel)}
                <li>
                  <span>
                    {item.name}
                    <span class="small">
                      {item.unitLabel} &times; {item.quantity}
                    </span>
                  </span>
                  <span>{formatPaise(item.unitPricePaise * item.quantity)}</span>
                </li>
              {/each}
            </ul>
          </section>

          <Card as="section" aria-label={strings.orders.bill}>
            <dl class="bill">
              <div class="line">
                <dt>{strings.cart.itemTotal}</dt>
                <dd>{formatPaise(order.subtotalPaise)}</dd>
              </div>
              <div class="line">
                <dt>{strings.cart.deliveryFee}</dt>
                <dd>
                  {order.deliveryFeePaise === 0
                    ? strings.cart.free
                    : formatPaise(order.deliveryFeePaise)}
                </dd>
              </div>
              {#if order.smallCartFeePaise > 0}
                <div class="line">
                  <dt>{strings.cart.handlingFee}</dt>
                  <dd>{formatPaise(order.smallCartFeePaise)}</dd>
                </div>
              {/if}
              {#if order.savingsPaise > 0}
                <div class="line save">
                  <dt>{strings.cart.youSave}</dt>
                  <dd>{formatPaise(order.savingsPaise)}</dd>
                </div>
              {/if}
              <div class="line total">
                <dt>{strings.cart.total}</dt>
                <dd>{formatPaise(order.totalPaise)}</dd>
              </div>
            </dl>
            <p class="small pay">
              {strings.orders.paymentMethod[order.paymentMethod]} &middot;
              {strings.orders.paymentStatus[order.paymentStatus]}
            </p>
          </Card>

          {#if order.status === "placed" || order.status === "awaiting_payment"}
            <Button
              variant="danger"
              large
              disabled={cancelling}
              onclick={() => (confirmingCancel = true)}
            >
              {strings.orders.cancel}
            </Button>
            {#if cancelFailed}
              <p class="problem" role="alert">{strings.orders.cancelFailed}</p>
            {/if}
          {:else if order.status !== "cancelled" && order.status !== "delivered"}
            <p class="small">{strings.orders.cantCancel}</p>
            {#if storePhone}
              <Button href={`tel:${storePhone}`} large>
                {strings.orders.callStore}
              </Button>
            {:else}
              <p class="small">{strings.orders.contactStore}</p>
            {/if}
          {/if}
        </div>
      </div>
    </div>

    <ConfirmDialog
      bind:open={confirmingCancel}
      title={strings.orders.confirmCancel}
      description={strings.orders.confirmCancelText}
      confirmLabel={strings.orders.cancel}
      cancelLabel={strings.orders.keepOrder}
      onconfirm={cancel}
    />
  {/if}
</ShopPage>

<style lang="postcss">
  @reference 'src/app.css';

  .back {
    @apply text-sm font-semibold text-primary;
  }
  .page {
    @apply flex w-full flex-col gap-4;
  }
  .missing {
    @apply flex flex-col items-start gap-3;
  }
  .head {
    @apply flex items-start justify-between gap-3;
  }
  .title {
    @apply text-2xl font-extrabold;
  }
  .small {
    @apply text-sm text-text-muted;
  }
  .muted {
    @apply text-text-muted;
  }
  .strong {
    @apply font-bold;
  }
  .problem {
    @apply text-sm font-semibold text-danger;
  }
  .block {
    @apply block h-28 w-full;
  }

  /* The 4-digit code is the biggest thing on the page once the order is on its way */
  .code {
    --fill: var(--color-secondary);
    @apply edge flex flex-col items-center gap-1 rounded-container bg-secondary-tint p-4 text-center;
  }
  .digits {
    @apply font-mono text-5xl font-extrabold tracking-[0.3em];
  }

  /* Phone: one column. Laptop: progress and address on the left, items and bill on the right */
  .columns {
    @apply flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8;
  }
  .column {
    @apply flex flex-col gap-4;
  }
  .section {
    @apply flex flex-col gap-2;
  }
  .heading {
    @apply text-lg font-extrabold;
  }

  .timeline {
    @apply flex flex-col;
  }
  .timeline li {
    @apply relative flex items-start gap-3 pb-4 last:pb-0;
  }
  /* The line joining the dots */
  .timeline li:not(:last-child)::before {
    content: "";
    @apply absolute top-4 bottom-0 left-[0.4375rem] w-0.5 bg-border-muted;
  }
  .dot {
    --fill: var(--color-foreground);
    @apply edge-flat mt-1 size-4 shrink-0 rounded-full bg-foreground;
  }
  .latest .dot {
    --fill: var(--color-primary);
    @apply bg-primary;
  }
  .what {
    @apply flex min-w-0 flex-1 flex-col;
  }
  .when {
    @apply shrink-0;
  }

  .address {
    @apply flex flex-col gap-1 text-sm;
  }
  .items {
    @apply flex flex-col gap-2;
  }
  .items li {
    @apply flex justify-between gap-3;
  }
  .bill {
    @apply flex flex-col gap-1 text-sm;
  }
  .line {
    @apply flex justify-between;
  }
  .save {
    @apply font-semibold text-success;
  }
  .total {
    @apply mt-1 border-t-2 border-border-muted pt-2 text-base font-extrabold;
  }
  .pay {
    @apply mt-2;
  }
</style>
