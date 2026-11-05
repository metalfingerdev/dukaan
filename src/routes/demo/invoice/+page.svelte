<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { cartLines, bill } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Invoice"
	replaces="/orders/[id]/invoice and /admin/orders/[id]/invoice"
	wide
	needs={[
		'Plain, black on white, readable when printed or saved as PDF; no theme colours needed',
		'Seller name, address and GSTIN at the top; invoice number and date; bill-to',
		'A table of items with quantity, rate and amount; totals at the bottom',
		'Receipt-size and full-page layouts; a Print button that is hidden when printing',
		'Do not state tax rules in the copy; the accountant decides what the invoice says'
	]}
>
	<div class="paper">
		<div class="d-between">
			<div>
				<h2 class="d-title">Dukaan</h2>
				<p class="d-muted">Main road, Kothri Kalan, Madhya Pradesh</p>
				<p class="d-muted">GSTIN: (placeholder)</p>
			</div>
			<div class="right">
				<p><b>Invoice no.</b> DK/2026-27/000042</p>
				<p><b>Date</b> 3 Nov 2026</p>
				<p><b>Order</b> #1042</p>
			</div>
		</div>
		<p><b>Bill to</b> Asha Verma, Near the post office, Ward 4</p>
		<table class="d-table">
			<thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
			<tbody>
				{#each cartLines as line (line.product.id)}
					<tr>
						<td>{line.product.name} ({line.product.unit})</td>
						<td>{line.quantity}</td>
						<td>{formatPaise(line.product.pricePaise)}</td>
						<td>{formatPaise(line.product.pricePaise * line.quantity)}</td>
					</tr>
				{/each}
				<tr><td colspan="3">Delivery</td><td>{formatPaise(bill.deliveryFeePaise)}</td></tr>
				<tr class="total"><td colspan="3">Total</td><td>{formatPaise(bill.totalPaise)}</td></tr>
			</tbody>
		</table>
	</div>
	<div class="d-row">
		<button type="button" class="d-btn d-btn-primary">Print or save as PDF</button>
		<button type="button" class="d-btn">Receipt size</button>
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.paper {
		@apply flex flex-col gap-3 bg-white p-4 text-black;
	}
	.right {
		@apply text-right text-sm;
	}
	.total td {
		@apply font-extrabold;
	}
</style>
