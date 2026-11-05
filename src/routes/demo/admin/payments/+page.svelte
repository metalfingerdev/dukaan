<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { payments } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Payments"
	replaces="/admin/payments"
	wide
	needs={[
		'A read-only list of Razorpay payments, newest first: order, method, amount, status, refund state',
		'A failed refund is red and says what to do (refund from the Razorpay dashboard)',
		'Link each row to its order'
	]}
>
	<table class="d-table">
		<thead><tr><th>Payment</th><th>Order</th><th>Method</th><th>Amount</th><th>Status</th><th>Refund</th></tr></thead>
		<tbody>
			{#each payments as payment (payment.id)}
				<tr>
					<td>{payment.id}</td>
					<td><a href="/demo/admin/board">#{payment.order}</a></td>
					<td>{payment.method}</td>
					<td>{formatPaise(payment.amountPaise)}</td>
					<td><span class="d-pill d-pill-ok">{payment.status}</span></td>
					<td>{#if payment.refund}<span class="d-pill d-pill-bad">{payment.refund}</span>{:else}&ndash;{/if}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="d-banner">Refund failed for order #1036. Refund it from the Razorpay dashboard.</p>
</Frame>
