<script lang="ts">
	// The printable invoice, shared by the customer's and the admin's invoice pages. Print it with the
	// browser ("Print → Save as PDF"); no PDF library. Two layouts: a full page, and a narrow receipt
	// for a small thermal printer. Tax columns appear only when the invoice carries a GSTIN.
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '#convex/_generated/api.js';
	import { formatDateTime, formatPaise } from '../format.js';
	import { strings } from '../strings.js';

	type Invoice = NonNullable<FunctionReturnType<typeof api.store.orders.getInvoice>>;
	let { invoice, receipt = false }: { invoice: Invoice; receipt?: boolean } = $props();
	const text = strings.invoice;
	const withTax = $derived(invoice.taxTotals !== undefined);
	const paymentLine = $derived(invoice.paidWith ? text.paidBy[invoice.paidWith] : text.payment[invoice.paymentMethod]);
</script>

<article
	class="invoice mx-auto flex w-full flex-col gap-4 bg-white text-black {receipt
		? 'max-w-[80mm] p-2 text-xs'
		: 'max-w-3xl p-6 text-sm'}"
	aria-label={text.titleWithNumber(invoice.invoiceNumber)}
>
	<header class="flex flex-wrap justify-between gap-4 {receipt ? 'flex-col text-center' : ''}">
		<div>
			<p class="text-base font-bold">{invoice.seller.legalName}</p>
			<p>{invoice.seller.addressLine}</p>
			{#if invoice.seller.gstin}<p>{text.gstin}: {invoice.seller.gstin}</p>{/if}
		</div>
		<div class={receipt ? '' : 'text-right'}>
			<p class="text-base font-bold">{text.title}</p>
			<p>{text.number} {invoice.invoiceNumber}</p>
			<p>{text.date}: {formatDateTime(invoice.issuedAt)}</p>
			<p>{text.order} #{invoice.orderNumber}</p>
		</div>
	</header>

	<section>
		<p class="font-semibold">{text.billTo}</p>
		<p>{invoice.buyer.name}</p>
		<p>{invoice.buyer.line1}</p>
		{#if invoice.buyer.landmark}<p>{invoice.buyer.landmark}</p>{/if}
		<p>{invoice.buyer.area}</p>
	</section>

	{#if receipt}
		<ul class="flex flex-col gap-1 border-y border-dashed border-black py-2">
			{#each invoice.lines as line, i (i)}
				<li>
					<p>{line.name} <span class="opacity-70">{line.unitLabel}</span></p>
					<p class="flex justify-between">
						<span>{line.quantity} × {formatPaise(line.ratePaise)}{#if line.gstRatePercent} · {text.gstRate} {line.gstRatePercent}{/if}</span>
						<span>{formatPaise(line.amountPaise)}</span>
					</p>
				</li>
			{/each}
		</ul>
	{:else}
		<table class="w-full border-collapse">
			<thead>
				<tr class="border-b border-black text-left">
					<th class="py-1 pr-2">{text.item}</th>
					{#if withTax}<th class="py-1 pr-2">{text.hsn}</th>{/if}
					<th class="py-1 pr-2 text-right">{text.qty}</th>
					<th class="py-1 pr-2 text-right">{text.rate}</th>
					{#if withTax}
						<th class="py-1 pr-2 text-right">{text.gstRate}</th>
						<th class="py-1 pr-2 text-right">{text.taxable}</th>
						<th class="py-1 pr-2 text-right">{text.cgst}</th>
						<th class="py-1 pr-2 text-right">{text.sgst}</th>
					{/if}
					<th class="py-1 text-right">{text.amount}</th>
				</tr>
			</thead>
			<tbody>
				{#each invoice.lines as line, i (i)}
					<tr class="border-b border-black/20 align-top">
						<td class="py-1 pr-2">{line.name} <span class="opacity-70">{line.unitLabel}</span></td>
						{#if withTax}<td class="py-1 pr-2">{line.hsn ?? ''}</td>{/if}
						<td class="py-1 pr-2 text-right">{line.quantity}</td>
						<td class="py-1 pr-2 text-right">{formatPaise(line.ratePaise)}</td>
						{#if withTax}
							<td class="py-1 pr-2 text-right">{line.gstRatePercent ?? ''}</td>
							<td class="py-1 pr-2 text-right">{formatPaise(line.taxablePaise ?? line.amountPaise)}</td>
							<td class="py-1 pr-2 text-right">{line.cgstPaise !== undefined ? formatPaise(line.cgstPaise) : ''}</td>
							<td class="py-1 pr-2 text-right">{line.sgstPaise !== undefined ? formatPaise(line.sgstPaise) : ''}</td>
						{/if}
						<td class="py-1 text-right">{formatPaise(line.amountPaise)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<dl class="ml-auto flex w-full flex-col gap-1 {receipt ? '' : 'max-w-xs'}">
		<div class="flex justify-between"><dt>{text.itemTotal}</dt><dd>{formatPaise(invoice.subtotalPaise)}</dd></div>
		{#if invoice.deliveryFeePaise > 0}
			<div class="flex justify-between"><dt>{text.deliveryFee}</dt><dd>{formatPaise(invoice.deliveryFeePaise)}</dd></div>
		{/if}
		{#if invoice.smallCartFeePaise > 0}
			<div class="flex justify-between"><dt>{text.smallCartFee}</dt><dd>{formatPaise(invoice.smallCartFeePaise)}</dd></div>
		{/if}
		<div class="flex justify-between border-t border-black pt-1 text-base font-bold">
			<dt>{text.total}</dt><dd>{formatPaise(invoice.totalPaise)}</dd>
		</div>
		{#if invoice.taxTotals}
			<div class="flex justify-between"><dt>{text.taxable}</dt><dd>{formatPaise(invoice.taxTotals.taxablePaise)}</dd></div>
			<div class="flex justify-between"><dt>{text.cgst}</dt><dd>{formatPaise(invoice.taxTotals.cgstPaise)}</dd></div>
			<div class="flex justify-between"><dt>{text.sgst}</dt><dd>{formatPaise(invoice.taxTotals.sgstPaise)}</dd></div>
		{/if}
	</dl>

	<footer class="flex flex-col gap-1 {receipt ? 'text-center' : ''}">
		<p>{paymentLine}</p>
		{#if withTax}<p>{text.taxIncluded}</p>{/if}
		{#if invoice.savingsPaise > 0}<p>{text.youSaved(formatPaise(invoice.savingsPaise))}</p>{/if}
		<p class="font-semibold">{text.thanks}</p>
	</footer>
</article>

<style>
	@media print {
		@page {
			margin: 8mm;
		}
		.invoice {
			max-width: none;
			padding: 0;
		}
	}
</style>
