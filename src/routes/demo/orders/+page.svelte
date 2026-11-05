<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { orders } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';

	const pill = (status: string) =>
		status === 'Delivered' ? 'd-pill-ok' : status === 'Cancelled' ? 'd-pill-bad' : 'd-pill-warn';
</script>

<Frame
	title="My orders"
	replaces="/orders"
	needs={[
		'Newest first; a live order (placed, packed, on the way) stands out from past ones',
		'Each row: order number, when, item count, total, status pill',
		'Tapping a row opens the tracking screen',
		'Empty state with a link to the shelves; a "Load more" at the end'
	]}
>
	<h2 class="d-title">Your orders</h2>
	<ul class="d-stack">
		{#each orders as order (order.id)}
			<li>
				<a href="/demo/order" class="d-card d-between">
					<span>
						<b>Order #{order.id}</b><br />
						<span class="d-muted">{order.when} &middot; {order.items} items</span>
					</span>
					<span class="end">
						<b>{formatPaise(order.totalPaise)}</b>
						<span class="d-pill {pill(order.status)}">{order.status}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
	<button type="button" class="d-btn d-btn-block">Load more</button>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.end {
		@apply flex flex-col items-end gap-1;
	}
</style>
