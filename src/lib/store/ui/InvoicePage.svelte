<script lang="ts">
	// The frame around a printable invoice: back link, print and layout buttons (hidden on paper)
	import type { ComponentProps } from 'svelte';
	import { strings } from '../strings.js';
	import InvoiceDoc from './InvoiceDoc.svelte';

	type Props = {
		/** `undefined` while loading, `null` when there is no invoice (not delivered, or not yours) */
		invoice: ComponentProps<typeof InvoiceDoc>['invoice'] | null | undefined;
		error: boolean;
		backHref: string;
	};
	let { invoice, error, backHref }: Props = $props();
	const text = strings.invoice;
	let receipt = $state(false);
</script>

<svelte:head>
	<title>{invoice ? text.titleWithNumber(invoice.invoiceNumber) : text.title}</title>
</svelte:head>

<div class="flex flex-col gap-4 p-3 sm:p-4 print:p-0">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by the caller -->
	<a href={backHref} class="text-primary-600-400 text-sm print:hidden">&larr; {text.back}</a>

	{#if error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if invoice === undefined}
		<div class="bg-surface-100-900 h-96 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
	{:else if invoice === null}
		<p>{text.notReady}</p>
	{:else}
		<div class="flex flex-wrap gap-2 print:hidden">
			<button type="button" class="btn preset-filled-primary-500 min-h-11" onclick={() => window.print()}>
				{text.print}
			</button>
			<button type="button" class="btn preset-tonal min-h-11" onclick={() => (receipt = !receipt)}>
				{receipt ? text.fullPage : text.receipt}
			</button>
		</div>
		<div class="overflow-x-auto rounded border border-black/10 print:overflow-visible print:border-0">
			<InvoiceDoc {invoice} {receipt} />
		</div>
	{/if}
</div>
