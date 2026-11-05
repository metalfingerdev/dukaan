<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { cartLines, bill, orderSteps } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Order tracking"
	replaces="/orders/[id]"
	needs={[
		'The first thing seen is the current status in words, updating live without a refresh',
		'A vertical timeline of steps with times; the current step stands out',
		'The 4-digit delivery code, big, once the order is on the way ("tell this to your rider")',
		'The delivery partner\'s name with a tap-to-call button',
		'Items, bill, payment method and status, address',
		'Cancel while the store has not accepted; View invoice once delivered',
		'Variants: waiting for online payment (with a countdown), cancelled, delivery failed'
	]}
>
	<h2 class="d-title">Order #1042</h2>
	<p class="d-pill d-pill-warn">On the way</p>

	<ol class="steps">
		{#each orderSteps as step (step.label)}
			<li class:done={step.done} class:current={step.current}>
				<span class="dot"></span>
				<span>{step.label}</span>
				<span class="d-muted">{step.time}</span>
			</li>
		{/each}
	</ol>

	<div class="d-card code">
		<p class="d-muted">Your delivery code</p>
		<p class="digits">4 8 1 7</p>
		<p class="d-muted">Tell this to your delivery partner when you receive your order.</p>
	</div>

	<div class="d-card-flat d-between">
		<span><b>Deepak</b><br /><span class="d-muted">Your delivery partner</span></span>
		<a href="tel:+910000000000" class="d-btn d-btn-accent">Call</a>
	</div>

	<h3 class="d-sub">Items</h3>
	<ul class="d-list">
		{#each cartLines as line (line.product.id)}
			<li class="d-item">
				<span>{line.quantity} &times; {line.product.name} <span class="d-muted">{line.product.unit}</span></span>
				<span>{formatPaise(line.product.pricePaise * line.quantity)}</span>
			</li>
		{/each}
	</ul>
	<div class="d-between total"><span>To pay (cash on delivery)</span><span>{formatPaise(bill.totalPaise)}</span></div>
	<p class="d-muted">Home &middot; Near the post office, Ward 4, Kothri Kalan</p>
	<button type="button" class="d-btn d-btn-danger d-btn-block">Cancel order</button>
	<a href="/demo/invoice" class="d-btn d-btn-block">View invoice</a>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.steps {
		@apply flex flex-col gap-3;
	}
	.steps li {
		@apply text-text-muted flex items-center gap-3;
	}
	.steps li.done {
		@apply text-text;
	}
	.steps li.current {
		@apply font-extrabold;
	}
	.dot {
		@apply border-border size-4 shrink-0 rounded-full border-2;
	}
	.done .dot {
		@apply bg-primary;
	}
	.current .dot {
		@apply bg-secondary;
	}
	.code {
		@apply bg-secondary/10 text-center;
	}
	.digits {
		@apply text-4xl font-extrabold tracking-[0.3em];
	}
	.total {
		@apply border-border border-t-2 pt-2 font-extrabold;
	}
</style>
