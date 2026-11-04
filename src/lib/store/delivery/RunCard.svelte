<script lang="ts">
	import { resolve } from '$app/paths';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '#convex/_generated/api.js';
	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	type Run = FunctionReturnType<typeof api.store.delivery.myRuns>['toPickUp'][number];
	let { run }: { run: Run } = $props();
	const text = strings.delivery;
</script>

<a
	href={resolve('/delivery/orders/[id]', { id: run._id })}
	class="card preset-outlined-surface-300-700 flex min-h-16 flex-col gap-1 p-4"
>
	<span class="flex items-baseline justify-between gap-2">
		<span class="font-semibold">
			{text.orderNumber(run.orderNumber)}
			{#if !run.hasPin}<span class="badge preset-tonal-warning ml-1">{text.noPinBadge}</span>{/if}
		</span>
		<span class="text-surface-600-400 text-sm">{text.items(run.itemCount)} · {run.area}</span>
	</span>
	<span class="text-lg font-semibold">
		{run.collectPaise > 0 ? text.collect(formatPaise(run.collectPaise)) : text.alreadyPaid}
	</span>
</a>
