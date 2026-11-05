<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="My deliveries"
	replaces="/delivery"
	needs={[
		'Built for a rider on a bike: big text, big buttons, one hand',
		'Two lists: To pick up, and On the way; each card shows order number, area and what to collect',
		'The "collect" amount is the biggest number on the card (zero when already paid)',
		'A tally for today (deliveries done) and the cash the rider must hand over',
		'Empty state: "No orders for you right now"'
	]}
>
	<div class="d-card tally">
		<div><p class="d-muted">Delivered today</p><b class="big">9</b></div>
		<div><p class="d-muted">Cash to hand over</p><b class="big">{formatPaise(128400)}</b></div>
	</div>

	<h2 class="d-title">On the way</h2>
	<a href="/demo/rider/order" class="d-card d-stack">
		<div class="d-between"><b>Order #1042</b><span class="d-pill d-pill-warn">On the way</span></div>
		<p class="d-muted">Ward 4, near the post office &middot; Asha</p>
		<p class="collect">Collect {formatPaise(37100)}</p>
	</a>

	<h2 class="d-title">To pick up</h2>
	<a href="/demo/rider/order" class="d-card d-stack">
		<div class="d-between"><b>Order #1040</b><span class="d-pill">Packed</span></div>
		<p class="d-muted">College road &middot; Kavya</p>
		<p class="collect">Paid online &middot; collect nothing</p>
	</a>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.tally {
		@apply grid grid-cols-2 gap-3;
	}
	.big {
		@apply text-2xl font-extrabold;
	}
	.collect {
		@apply text-xl font-extrabold;
	}
</style>
