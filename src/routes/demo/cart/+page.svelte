<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { cartLines, bill } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Cart"
	replaces="/cart (and a bottom-sheet drawer later)"
	needs={[
		'Each line: photo, name, unit, line price, and the same stepper as the tiles',
		'A bill: items total, delivery fee, small-cart fee, and "You save" when MRP is higher',
		'Tell them how much more to spend for free delivery',
		'Checkout button is always in reach; disabled with a reason when the store is closed',
		'Empty state with a way back to the shelves',
		'Prices come from the server; the cart shows them live, never stored'
	]}
>
	<h2 class="d-title">Your cart</h2>
	<ul class="d-list">
		{#each cartLines as line (line.product.id)}
			<li class="d-item">
				<span class="d-img thumb">photo</span>
				<span class="grow">
					<b>{line.product.name}</b><br />
					<span class="d-muted">{line.product.unit}</span>
				</span>
				<span class="d-row"
					><button type="button" class="d-btn d-btn-sm" aria-label="Remove one">&minus;</button>
					<b>{line.quantity}</b>
					<button type="button" class="d-btn d-btn-sm" aria-label="Add one">+</button></span
				>
				<b>{formatPaise(line.product.pricePaise * line.quantity)}</b>
			</li>
		{/each}
	</ul>

	<div class="d-card-flat d-stack">
		<div class="d-between"><span>Items</span><span>{formatPaise(bill.subtotalPaise)}</span></div>
		<div class="d-between"><span>Delivery</span><span>{formatPaise(bill.deliveryFeePaise)}</span></div>
		<div class="d-between save"><span>You save</span><span>{formatPaise(bill.savingsPaise)}</span></div>
		<div class="d-between total"><span>To pay</span><span>{formatPaise(bill.totalPaise)}</span></div>
	</div>
	<p class="d-banner">Add {formatPaise(5000)} more for free delivery.</p>
	<a href="/demo/checkout" class="d-btn d-btn-primary d-btn-block">Checkout</a>

	<h3 class="d-sub">Store closed variant</h3>
	<p class="d-banner">The store is closed right now. You can fill your cart; checkout opens at 9:00 am.</p>
	<button type="button" class="d-btn d-btn-block" disabled>Checkout</button>

	<h3 class="d-sub">Empty variant</h3>
	<div class="d-card-flat empty">
		<b>Your cart is empty</b>
		<a href="/demo/home" class="d-btn">Start shopping</a>
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.thumb {
		@apply size-12 shrink-0;
	}
	.grow {
		@apply min-w-0 flex-1;
	}
	.save {
		@apply text-success;
	}
	.total {
		@apply border-border border-t-2 pt-2 text-lg font-extrabold;
	}
	.empty {
		@apply flex flex-col items-start gap-2;
	}
</style>
