<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { board } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';

	const action: Record<string, string> = {
		New: 'Accept',
		Accepted: 'Mark packed',
		Packed: 'Out for delivery',
		'Out for delivery': ''
	};
</script>

<Frame
	title="Order board"
	replaces="/admin/orders"
	wide
	needs={[
		'The screen staff keep open all day: one column per status, newest first, readable from a metre away',
		'A card: order number, customer, age, item count, total, how they pay',
		'One obvious next action per card (Accept, Mark packed, Out for delivery) and a quieter Reject',
		'A packed card has a delivery-partner select',
		'A "Needs you" strip on top for failed deliveries (Pack again or Cancel)',
		'A sound and a flash when a new order arrives'
	]}
>
	<p class="d-banner">Needs you: Order #1037 delivery failed ("customer not reachable"). <button type="button" class="d-btn d-btn-sm">Pack again</button> <button type="button" class="d-btn d-btn-sm d-btn-danger">Cancel</button></p>
	<div class="columns">
		{#each Object.entries(board) as [column, orders] (column)}
			<section class="column">
				<h3 class="d-sub">{column} <span class="d-pill">{orders.length}</span></h3>
				{#each orders as order (order.id)}
					<div class="d-card d-stack">
						<div class="d-between"><b>#{order.id}</b><span class="d-muted">{order.age}</span></div>
						<p>{order.customer} &middot; {order.items} items &middot; <b>{formatPaise(order.totalPaise)}</b></p>
						<span class="d-pill d-pill-warn self">{order.pay}</span>
						{#if column === 'Packed'}
							<select class="d-input"><option>Assign partner...</option><option>Deepak</option></select>
						{/if}
						{#if action[column]}
							<button type="button" class="d-btn d-btn-primary">{action[column]}</button>
						{/if}
						{#if column === 'New'}
							<button type="button" class="d-btn d-btn-sm">Reject</button>
						{/if}
					</div>
				{/each}
			</section>
		{/each}
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.columns {
		@apply grid gap-3 md:grid-cols-2 xl:grid-cols-4;
	}
	.column {
		@apply bg-midground rounded-container flex flex-col gap-3 p-2;
	}
	.self {
		@apply self-start;
	}
</style>
