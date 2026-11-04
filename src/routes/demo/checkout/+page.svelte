<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { addresses, bill } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Checkout"
	replaces="/checkout"
	needs={[
		'One scrolling page, top to bottom: address, delivery time, payment, summary, place order',
		'Address: pick a saved one or add new; every address needs a map pin and a landmark (riders phone the customer)',
		'Delivery time: "as soon as possible" or a slot',
		'Payment: Cash on delivery, UPI on delivery, or Pay online now (opens Razorpay)',
		'The total and place-order button stay visible; the button says what it will do',
		'Show server errors in words ("Only 3 Onion left"), next to the button'
	]}
>
	<h3 class="d-sub">1. Delivery address</h3>
	{#each addresses as address, i (address.id)}
		<label class="d-card-flat choice">
			<input type="radio" name="address" checked={i === 0} />
			<span>
				<b>{address.label}</b> &middot; {address.name}<br />
				<span class="d-muted">{address.line}</span>
			</span>
		</label>
	{/each}
	<button type="button" class="d-btn">+ Add a new address</button>

	<h3 class="d-sub">2. Delivery time</h3>
	<label class="d-card-flat choice"><input type="radio" name="slot" checked /> As soon as possible (~30 min)</label>
	<label class="d-card-flat choice"><input type="radio" name="slot" /> 7:00 pm to 8:00 pm</label>

	<h3 class="d-sub">3. Payment</h3>
	<label class="d-card-flat choice"><input type="radio" name="pay" checked /> Cash on delivery</label>
	<label class="d-card-flat choice"><input type="radio" name="pay" /> UPI on delivery</label>
	<label class="d-card-flat choice"><input type="radio" name="pay" /> Pay online now</label>

	<h3 class="d-sub">4. Summary</h3>
	<div class="d-card-flat d-stack">
		<div class="d-between"><span>Items (4)</span><span>{formatPaise(bill.subtotalPaise)}</span></div>
		<div class="d-between"><span>Delivery</span><span>{formatPaise(bill.deliveryFeePaise)}</span></div>
		<div class="d-between total"><span>To pay</span><span>{formatPaise(bill.totalPaise)}</span></div>
	</div>
	<p class="d-banner">Error variant: Only 1 Banana left. Update your cart and try again.</p>
	<button type="button" class="d-btn d-btn-primary d-btn-block">Place order &middot; {formatPaise(bill.totalPaise)}</button>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.choice {
		@apply flex items-start gap-3;
	}
	.total {
		@apply border-border border-t-2 pt-2 text-lg font-extrabold;
	}
</style>
