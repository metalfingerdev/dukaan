<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { cartLines, bill } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Delivery"
	replaces="/delivery/orders/[id]"
	needs={[
		'Top: a huge "Collect ₹…" line; if already paid, say so in green',
		'Tap-to-call the customer and open Maps (saved pin, else a search on the address) are big buttons',
		'Address and landmark in plain, large text',
		'An items checklist the rider ticks while packing the bag',
		'Actions in order: Picked up, then Delivered (asks for the customer\'s 4-digit code and how they paid), or Couldn\'t deliver (with a reason)',
		'For UPI at the door: "Show QR" with a live paid/unpaid status'
	]}
>
	<h2 class="d-title">Order #1042</h2>
	<p class="collect">Collect {formatPaise(bill.totalPaise)}</p>
	<div class="d-row">
		<a href="tel:+910000000000" class="d-btn d-btn-accent grow">Call Asha</a>
		<a href="/demo/rider/order" class="d-btn grow">Maps</a>
	</div>
	<div class="d-card-flat">
		<p>Near the post office, Ward 4, Kothri Kalan</p>
		<p class="d-muted">Landmark: blue gate opposite the temple</p>
	</div>

	<h3 class="d-sub">Items</h3>
	<ul class="d-list">
		{#each cartLines as line (line.product.id)}
			<li class="d-item">
				<label class="d-row"><input type="checkbox" /> {line.quantity} &times; {line.product.name}</label>
				<span class="d-muted">{line.product.unit}</span>
			</li>
		{/each}
	</ul>

	<button type="button" class="d-btn d-btn-block">Customer paying by UPI? Show QR</button>
	<h3 class="d-sub">Delivered</h3>
	<label class="d-field">Customer's code <input class="d-input" inputmode="numeric" placeholder="4 digits" /></label>
	<div class="d-row"><label class="d-row"><input type="radio" name="paid" checked /> Cash</label><label class="d-row"><input type="radio" name="paid" /> UPI</label></div>
	<button type="button" class="d-btn d-btn-primary d-btn-block">Delivered</button>
	<button type="button" class="d-btn d-btn-danger d-btn-block">Couldn't deliver</button>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.collect {
		@apply text-3xl font-extrabold;
	}
	.grow {
		@apply flex-1;
	}
</style>
