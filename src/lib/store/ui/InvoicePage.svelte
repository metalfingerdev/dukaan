<script lang="ts">
  // The frame around a printable invoice: back link, print and layout buttons (hidden on paper)
  import type { ComponentProps } from "svelte";
  import { strings } from "../strings.js";
  import InvoiceDoc from "./InvoiceDoc.svelte";
  import Button from "#lib/ui/Button.svelte";

  type Props = {
    /** `undefined` while loading, `null` when there is no invoice (not delivered, or not yours) */
    invoice: ComponentProps<typeof InvoiceDoc>["invoice"] | null | undefined;
    error: boolean;
    backHref: string;
  };
  let { invoice, error, backHref }: Props = $props();
  const text = strings.invoice;
  let receipt = $state(false);
</script>

<svelte:head>
  <title>
    {invoice ? text.titleWithNumber(invoice.invoiceNumber) : text.title}
  </title>
</svelte:head>

<div class="frame">
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the caller -->
  <a href={backHref} class="back">&larr; {text.back}</a>

  {#if error}
    <p class="problem">{strings.common.error}</p>
  {:else if invoice === undefined}
    <div class="loading bone" aria-busy="true" aria-label={strings.common.loading}></div>
  {:else if invoice === null}
    <p>{text.notReady}</p>
  {:else}
    <div class="controls">
      <Button variant="primary" onclick={() => window.print()}>
        {text.print}
      </Button>
      <Button onclick={() => (receipt = !receipt)}>
        {receipt ? text.fullPage : text.receipt}
      </Button>
    </div>
    <!-- The invoice itself stays black on white, whatever the theme: it is a paper document -->
    <div class="paper">
      <InvoiceDoc {invoice} {receipt} />
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference 'src/app.css';

  .frame {
    @apply mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-3 sm:p-4 lg:px-8 print:p-0;
  }
  .back {
    @apply text-sm font-semibold text-primary print:hidden;
  }
  .controls {
    @apply flex flex-wrap gap-2 print:hidden;
  }
  .paper {
    @apply overflow-x-auto rounded-lg border-2 border-border-muted print:overflow-visible print:border-0;
  }
  .loading {
    @apply h-96;
  }
  .problem {
    @apply text-sm font-semibold text-danger;
  }
</style>
