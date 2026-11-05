<script lang="ts">
	// Stock actions and history for one product, opened from a row of /admin/products. Every action
	// goes through `adjustStock` on the server, so each leaves a history row.
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { formatDateTime } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';

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

<div class="panel">
	<div class="row">
		<span class="narrow">
			<Field label={text.quantity}>
				<input inputmode="numeric" autocomplete="off" bind:value={quantity} />
			</Field>
		</span>
		<Button variant="primary" disabled={busy} onclick={() => adjust('receiveStock')}>{text.received}</Button>
		<Button disabled={busy} onclick={() => adjust('writeOff')}>{text.damaged}</Button>
	</div>

	<div class="count">
		<div class="row">
			<span class="wide">
				<Field label={text.counted} hint={text.countHint}>
					<input inputmode="numeric" autocomplete="off" bind:value={counted} />
				</Field>
			</span>
			<Button disabled={busy} onclick={count}>{text.setCount}</Button>
		</div>
		{#if held.data}<span class="small">{text.held(held.data)}</span>{/if}
	</div>

	{#if message}<p class="message" role="status">{message}</p>{/if}

	<div>
		<h3 class="heading">{text.history}</h3>
		{#if history.data === undefined}
			<div class="bone loading" aria-busy="true"></div>
		{:else if history.data.length === 0}
			<p class="small">{text.noHistory}</p>
		{:else}
			<ul class="history">
				{#each history.data as row (row._id)}
					<li>
						<span>
							{text.reason[row.reason]}
							<span class="small">{formatDateTime(row.at)}</span>
						</span>
						<span class="change">
							{row.delta > 0 ? '+' : ''}{row.delta} → {row.stockAfter}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style lang="postcss">
	@reference 'src/app.css';

	.panel {
		@apply flex flex-col gap-4 border-t-2 border-border-muted pt-3;
	}
	.row {
		@apply flex flex-wrap items-end gap-2;
	}
	.narrow {
		@apply w-28;
	}
	.wide {
		@apply w-40;
	}
	.count {
		@apply flex flex-col gap-1;
	}
	.small {
		@apply text-xs text-text-muted;
	}
	.message {
		@apply text-sm font-semibold;
	}
	.heading {
		@apply mb-1 text-sm font-extrabold;
	}
	.history {
		@apply flex flex-col gap-1 text-sm;
	}
	.history li {
		@apply flex justify-between gap-2;
	}
	.change {
		@apply tabular-nums;
	}
	.loading {
		@apply block h-12 w-full;
	}
</style>
