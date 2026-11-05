<script lang="ts">
	import { ConvexError } from 'convex/values';
	import { toast } from 'svelte-sonner';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { createClock } from '#lib/store/now.svelte.js';
	import { strings } from '#lib/store/strings.js';
	import { createOrderAlerts } from './orderAlerts.svelte.js';
	import OrderCard from './OrderCard.svelte';
	import RejectDialog from './RejectDialog.svelte';
	import Button from '#lib/ui/Button.svelte';

	const text = strings.admin.board;
	const client = useConvexClient();
	// Ticks every 15 seconds so "4 min ago" and the waiting highlight stay current
	const clock = createClock(15_000);

	const columns = ['placed', 'accepted', 'packed', 'out_for_delivery'] as const;
	type Column = (typeof columns)[number];

	// One live query per column, so the board updates without polling
	const lists = {
		placed: useQuery(api.store.admin.orders.listOrders, { status: 'placed' }),
		accepted: useQuery(api.store.admin.orders.listOrders, { status: 'accepted' }),
		packed: useQuery(api.store.admin.orders.listOrders, { status: 'packed' }),
		out_for_delivery: useQuery(api.store.admin.orders.listOrders, { status: 'out_for_delivery' }),
		delivery_failed: useQuery(api.store.admin.orders.listOrders, { status: 'delivery_failed' })
	};

	const partners = useQuery(api.store.admin.delivery.listPartners, {});
	const activePartners = $derived((partners.data ?? []).filter((partner) => partner.isActive));

	const alerts = createOrderAlerts(() => lists.placed.data?.map((order) => order._id));

	// On a phone one column shows at a time; from lg up all four sit side by side
	let selected = $state<Column>('placed');
	let busyId = $state<Id<'orders'> | null>(null);
	let rejecting = $state<{ _id: Id<'orders'>; orderNumber: number; status: string } | null>(null);

	const run = async (orderId: Id<'orders'>, call: () => Promise<unknown>) => {
		busyId = orderId;
		try {
			await call();
			rejecting = null;
		} catch (error) {
			const code = error instanceof ConvexError ? (error.data as { code?: string })?.code : undefined;
			if (code === 'INVALID_TRANSITION') {
				rejecting = null;
				toast.info(text.alreadyMoved);
			} else if (code === 'NOT_PACKED') {
				toast.info(text.notPacked);
			} else if (code === 'PARTNER_NOT_FOUND') {
				toast.error(text.partnerGone);
			} else if (code === 'NO_PARTNER') {
				toast.error(text.needPartner);
			} else if (code === 'INVALID_REASON') {
				toast.error(text.reasonRequired);
			} else {
				toast.error(text.failed);
			}
		} finally {
			busyId = null;
		}
	};

	const accept = (orderId: Id<'orders'>) =>
		run(orderId, () => client.mutation(api.store.admin.orders.acceptOrder, { orderId }));
	const pack = (orderId: Id<'orders'>) =>
		run(orderId, () => client.mutation(api.store.admin.orders.packOrder, { orderId }));
	const assign = (orderId: Id<'orders'>, partnerId: Id<'deliveryPartners'>) =>
		run(orderId, () => client.mutation(api.store.admin.orders.assignPartner, { orderId, partnerId }));
	const start = (orderId: Id<'orders'>) =>
		run(orderId, () => client.mutation(api.store.admin.orders.startDelivery, { orderId }));
	const repack = (orderId: Id<'orders'>) =>
		run(orderId, () => client.mutation(api.store.admin.orders.repackOrder, { orderId }));
	const reject = (orderId: Id<'orders'>, reason: string) =>
		run(orderId, () => client.mutation(api.store.admin.orders.cancelOrder, { orderId, reason }));
</script>

<section class="board" aria-label={text.title}>
	<div class="head">
		<h1 class="title">{text.title}</h1>
		<Button
			variant={alerts.soundOn ? 'primary' : 'plain'}
			aria-pressed={alerts.soundOn}
			onclick={alerts.toggleSound}
			title={text.alerts.hint}
		>
			{alerts.soundOn ? text.alerts.on : text.alerts.off}
		</Button>
	</div>

	{#if lists.delivery_failed.data?.length}
		<section class="failed" aria-labelledby="failed-title">
			<h2 id="failed-title" class="failed-title">{text.failedTitle}</h2>
			<p class="small">{text.failedHint}</p>
			<div class="cards">
				{#each lists.delivery_failed.data as order (order._id)}
					<OrderCard
						{order}
						now={clock.now}
						busy={busyId === order._id}
						partners={activePartners}
						onassign={() => {}}
						onstart={() => {}}
						onrepack={() => repack(order._id)}
						onaccept={() => {}}
						onpack={() => {}}
						onreject={() => (rejecting = { _id: order._id, orderNumber: order.orderNumber, status: order.status })}
					/>
				{/each}
			</div>
		</section>
	{/if}

	<!-- A phone shows one column at a time, chosen here; a laptop shows all four -->
	<div class="tabs" role="tablist" aria-label={text.title}>
		{#each columns as column (column)}
			{@const count = lists[column].data?.length}
			<button
				type="button"
				role="tab"
				aria-selected={selected === column}
				class="tab"
				class:on={selected === column}
				onclick={() => (selected = column)}
			>
				<span>{text.columns[column]}</span>
				<b>{count ?? '–'}</b>
			</button>
		{/each}
	</div>

	<div class="columns">
		{#each columns as column (column)}
			{@const list = lists[column]}
			<div class="column" class:shown={selected === column} role="tabpanel">
				<h2 class="column-title">
					{text.columns[column]}
					<span class="small">{list.data?.length ?? ''}</span>
				</h2>
				{#if list.error}
					<p class="problem" role="alert">{strings.common.error}</p>
				{:else if list.data === undefined}
					<div class="bone holder" aria-busy="true" aria-label={strings.common.loading}></div>
				{:else if list.data.length === 0}
					<p class="small">{text.empty[column]}</p>
				{:else}
					{#each list.data as order (order._id)}
						<OrderCard
							{order}
							now={clock.now}
							busy={busyId === order._id}
							partners={activePartners}
							onassign={(partnerId) => assign(order._id, partnerId)}
							onstart={() => start(order._id)}
							onrepack={() => repack(order._id)}
							onaccept={() => accept(order._id)}
							onpack={() => pack(order._id)}
							onreject={() => (rejecting = { _id: order._id, orderNumber: order.orderNumber, status: order.status })}
						/>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
</section>

<RejectDialog
	order={rejecting}
	busy={rejecting !== null && busyId === rejecting._id}
	onconfirm={(reason) => rejecting && reject(rejecting._id, reason)}
	onclose={() => (rejecting = null)}
/>

<style lang="postcss">
	@reference 'src/app.css';

	.board {
		@apply flex flex-col gap-3;
	}
	.head {
		@apply flex flex-wrap items-center justify-between gap-2;
	}
	.title {
		@apply text-2xl font-extrabold;
	}
	.small {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.failed {
		--fill: var(--color-secondary);
		@apply edge-flat flex flex-col gap-2 rounded-container bg-secondary/20 p-3;
	}
	.failed-title {
		@apply font-extrabold;
	}
	.cards {
		@apply grid gap-3 sm:grid-cols-2 xl:grid-cols-4;
	}
	.tabs {
		@apply grid grid-cols-4 gap-1 lg:hidden;
	}
	.tab {
		--fill: var(--color-foreground);
		@apply edge-flat flex min-h-12 flex-col items-center justify-center rounded-base bg-foreground px-1 text-xs;
	}
	.tab.on {
		--fill: var(--color-primary);
		@apply bg-primary text-foreground;
	}
	.columns {
		@apply grid gap-4 lg:grid-cols-4 lg:items-start;
	}
	.column {
		@apply hidden flex-col gap-3 lg:flex;
	}
	.column.shown {
		@apply flex;
	}
	.column-title {
		@apply hidden font-extrabold lg:block;
	}
	.holder {
		@apply h-28 w-full;
	}
</style>
