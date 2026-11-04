<script lang="ts">
	// Stock actions and history for one product, opened from a row of /admin/products. Every action
	// goes through `adjustStock` on the server, so each leaves a history row.
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { formatDateTime } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	let { productId, stock }: { productId: Id<'products'>; stock: number } = $props();

	const client = useConvexClient();
	const text = strings.admin.products.stock;

	const held = useQuery(api.store.admin.stock.heldStock, () => ({ productId }));
	const history = useQuery(api.store.admin.stock.stockHistory, () => ({ productId }));

	let quantity = $state('');
	let counted = $state('');
	let busy = $state(false);
	let message = $state('');

	const whole = (value: string, min: number) => {
		const trimmed = value.trim();
		return /^\d+$/.test(trimmed) && Number(trimmed) >= min ? Number(trimmed) : null;
	};

	const describe = (error: unknown) => {
		const data = error instanceof ConvexError ? (error.data as { code?: string; held?: number }) : null;
		if (data?.code === 'OUT_OF_STOCK') return text.errors.outOfStock;
		if (data?.code === 'STOCK_CHANGED') return text.errors.changed;
		if (data?.code === 'COUNT_BELOW_HELD') return text.errors.belowHeld(data.held ?? 0);
		if (data?.code === 'INVALID_QUANTITY') return text.errors.quantity;
		return strings.common.error;
	};

	const run = async (action: () => Promise<unknown>) => {
		busy = true;
		message = '';
		try {
			await action();
			message = text.done;
			quantity = '';
			counted = '';
		} catch (error) {
			message = describe(error);
		} finally {
			busy = false;
		}
	};

	const adjust = (kind: 'receiveStock' | 'writeOff') => {
		const amount = whole(quantity, 1);
		if (amount === null) {
			message = text.errors.quantity;
			return;
		}
		return run(() => client.mutation(api.store.admin.stock[kind], { productId, quantity: amount }));
	};

	const count = () => {
		const amount = whole(counted, 0);
		if (amount === null) {
			message = text.errors.count;
			return;
		}
		// `stock` is what is on screen now: if it moved before this lands, the server refuses
		return run(() =>
			client.mutation(api.store.admin.stock.setCountedStock, {
				productId,
				counted: amount,
				expectedStock: stock
			})
		);
	};
</script>

<div class="border-surface-200-800 flex flex-col gap-4 border-t pt-3">
	<div class="flex flex-wrap items-end gap-2">
		<label class="label w-28">
			<span class="label-text">{text.quantity}</span>
			<input class="input" inputmode="numeric" autocomplete="off" bind:value={quantity} />
		</label>
		<button type="button" class="btn preset-filled-primary-500 min-h-11" disabled={busy} onclick={() => adjust('receiveStock')}>
			{text.received}
		</button>
		<button type="button" class="btn preset-tonal min-h-11" disabled={busy} onclick={() => adjust('writeOff')}>
			{text.damaged}
		</button>
	</div>

	<div class="flex flex-col gap-1">
		<div class="flex flex-wrap items-end gap-2">
			<label class="label w-40">
				<span class="label-text">{text.counted}</span>
				<input class="input" inputmode="numeric" autocomplete="off" bind:value={counted} />
			</label>
			<button type="button" class="btn preset-tonal min-h-11" disabled={busy} onclick={count}>
				{text.setCount}
			</button>
		</div>
		<span class="text-surface-600-400 text-xs">{text.countHint}</span>
		{#if held.data}<span class="text-xs">{text.held(held.data)}</span>{/if}
	</div>

	{#if message}<p class="text-sm" role="status">{message}</p>{/if}

	<div>
		<h3 class="mb-1 text-sm font-semibold">{text.history}</h3>
		{#if history.data === undefined}
			<div class="bg-surface-100-900 h-12 animate-pulse rounded" aria-busy="true"></div>
		{:else if history.data.length === 0}
			<p class="text-surface-600-400 text-sm">{text.noHistory}</p>
		{:else}
			<ul class="flex flex-col gap-1 text-sm">
				{#each history.data as row (row._id)}
					<li class="flex justify-between gap-2">
						<span>
							{text.reason[row.reason]}
							<span class="text-surface-600-400 text-xs">{formatDateTime(row.at)}</span>
						</span>
						<span class="tabular-nums">
							{row.delta > 0 ? '+' : ''}{row.delta} → {row.stockAfter}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
