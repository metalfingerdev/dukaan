<script lang="ts">
	import { resolve } from '$app/paths';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '#convex/_generated/api.js';
	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import Card from '#lib/ui/Card.svelte';
	import Pill from '#lib/ui/Pill.svelte';

	type Run = FunctionReturnType<typeof api.store.delivery.myRuns>['toPickUp'][number];
	let { run }: { run?: Run } = $props();
	const text = strings.delivery;
</script>

<!-- No run means "still loading": the same card is drawn with placeholders -->
{#if run}
	<Card as="a" pressable href={resolve('/delivery/orders/[id]', { id: run._id })}>
		<span class="run">
			<span class="top">
				<b>
					{text.orderNumber(run.orderNumber)}
					{#if !run.hasPin}<Pill tone="warn">{text.noPinBadge}</Pill>{/if}
				</b>
				<span class="small">{text.items(run.itemCount)} · {run.area}</span>
			</span>
			<span class="collect">
				{run.collectPaise > 0 ? text.collect(formatPaise(run.collectPaise)) : text.alreadyPaid}
			</span>
		</span>
	</Card>
{:else}
	<Card>
		<span class="run" aria-hidden="true">
			<span class="top">
				<b class="bone">Order #0000</b>
				<span class="bone small">3 items · Main Market</span>
			</span>
			<span class="bone collect">Collect ₹000 cash</span>
		</span>
	</Card>
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.run {
		@apply flex min-h-14 flex-col gap-1;
	}
	.top {
		@apply flex items-baseline justify-between gap-2;
	}
	.small {
		@apply text-sm text-text-muted;
	}
	/* What the rider must collect is the biggest thing on the card */
	.collect {
		@apply text-xl font-extrabold;
	}
</style>
