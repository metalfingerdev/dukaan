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
		out_for_delivery: useQuery(api.store.admin.orders.listOrders, { status: 'out_for_delivery' })
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
	const reject = (orderId: Id<'orders'>, reason: string) =>
		run(orderId, () => client.mutation(api.store.admin.orders.cancelOrder, { orderId, reason }));
</script>

<section class="flex flex-col gap-3" aria-label={text.title}>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="h3">{text.title}</h1>
		<button
			type="button"
			class="btn btn-sm min-h-11 {alerts.soundOn ? 'preset-filled-primary-500' : 'preset-tonal'}"
			aria-pressed={alerts.soundOn}
			onclick={alerts.toggleSound}
			title={text.alerts.hint}
		>
			{alerts.soundOn ? text.alerts.on : text.alerts.off}
		</button>
	</div>

	<div class="grid grid-cols-4 gap-1 lg:hidden" role="tablist" aria-label={text.title}>
		{#each columns as column (column)}
			{@const count = lists[column].data?.length}
			<button
				type="button"
				role="tab"
				aria-selected={selected === column}
				class="btn min-h-12 flex-col gap-0 px-1 text-xs {selected === column ? 'preset-filled-primary-500' : 'preset-tonal'}"
				onclick={() => (selected = column)}
			>
				<span>{text.columns[column]}</span>
				<span class="font-semibold">{count ?? '–'}</span>
			</button>
		{/each}
	</div>

	<div class="grid gap-4 lg:grid-cols-4">
		{#each columns as column (column)}
			{@const list = lists[column]}
			<div class="flex-col gap-3 {selected === column ? 'flex' : 'hidden'} lg:flex" role="tabpanel">
				<h2 class="hidden font-semibold lg:block">
					{text.columns[column]}
					<span class="text-surface-600-400">{list.data?.length ?? ''}</span>
				</h2>
				{#if list.error}
					<p class="text-error-600-400 text-sm" role="alert">{strings.common.error}</p>
				{:else if list.data === undefined}
					<div class="bg-surface-100-900 h-28 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
				{:else if list.data.length === 0}
					<p class="text-surface-600-400 text-sm">{text.empty[column]}</p>
				{:else}
					{#each list.data as order (order._id)}
						<OrderCard
							{order}
							now={clock.now}
							busy={busyId === order._id}
							partners={activePartners}
							onassign={(partnerId) => assign(order._id, partnerId)}
							onstart={() => start(order._id)}
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
