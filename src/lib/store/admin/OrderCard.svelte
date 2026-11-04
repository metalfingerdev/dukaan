<script lang="ts">
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { formatAge, formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	type Order = FunctionReturnType<typeof api.store.admin.orders.listOrders>[number];
	type Props = {
		order: Order;
		now: number;
		busy: boolean;
		onaccept: () => void;
		onpack: () => void;
		onreject: () => void;
		/** Active partners to choose from */
		partners: { _id: Id<'deliveryPartners'>; name: string }[];
		onassign: (partnerId: Id<'deliveryPartners'>) => void;
		onstart: () => void;
	};
	let { order, now, busy, onaccept, onpack, onreject, partners, onassign, onstart }: Props = $props();

	const text = strings.admin.board;
	const SHOWN_ITEMS = 4;
	/** A new order left unanswered this long gets highlighted */
	const WAITING_TOO_LONG_MS = 5 * 60 * 1000;

	const age = $derived(Math.max(0, now - order.placedAt));
	const waitingTooLong = $derived(order.status === 'placed' && age > WAITING_TOO_LONG_MS);
	const payment = $derived(
		order.paymentStatus === 'paid'
			? text.paid(formatPaise(order.totalPaise))
			: order.paymentMethod === 'cod'
				? text.collect(formatPaise(order.totalPaise))
				: text.upi(formatPaise(order.totalPaise))
	);
</script>

<article
	class="card flex flex-col gap-2 p-3 {waitingTooLong
		? 'preset-filled-warning-100-900 ring-warning-500 ring-2'
		: 'preset-outlined-surface-300-700'}"
	aria-label={text.orderNumber(order.orderNumber)}
>
	<header class="flex items-baseline justify-between gap-2">
		<h3 class="font-semibold">{text.orderNumber(order.orderNumber)}</h3>
		<span class="text-sm {waitingTooLong ? 'font-semibold' : 'text-surface-600-400'}">
			{#if waitingTooLong}{text.waitingLong}:{/if}
			{formatAge(age)}
		</span>
	</header>

	<p class="text-sm">
		{text.items(order.itemCount)} · {order.area}
		{#if order.landmark}<span class="text-surface-600-400 block">{text.landmark(order.landmark)}</span>{/if}
	</p>

	<ul class="text-surface-700-300 text-sm">
		{#each order.items.slice(0, SHOWN_ITEMS) as item (item.name + item.unitLabel)}
			<li>{item.quantity} × {item.name} <span class="text-surface-600-400">{item.unitLabel}</span></li>
		{/each}
		{#if order.items.length > SHOWN_ITEMS}
			<li class="text-surface-600-400">{text.moreItems(order.items.length - SHOWN_ITEMS)}</li>
		{/if}
	</ul>

	{#if order.customerNote}
		<p class="text-sm italic">{text.note(order.customerNote)}</p>
	{/if}

	<p class="font-semibold">{payment}</p>

	<a
		href="tel:{order.contactPhone}"
		class="btn btn-sm preset-tonal min-h-11 justify-start gap-2"
		aria-label={text.call(order.contactName)}
	>
		<PhoneIcon class="size-4" aria-hidden="true" />
		{order.contactName}
	</a>

	{#if order.status === 'packed'}
		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">{text.partnerLabel}</span>
			<select
				class="select min-h-12"
				disabled={busy || partners.length === 0}
				value={order.assignedPartnerId ?? ''}
				onchange={(event) => {
					const id = event.currentTarget.value;
					if (id) onassign(id as Id<'deliveryPartners'>);
				}}
			>
				<option value="" disabled>{partners.length === 0 ? text.noPartners : text.choosePartner}</option>
				{#each partners as partner (partner._id)}
					<option value={partner._id}>{partner.name}</option>
				{/each}
			</select>
		</label>
		<button
			type="button"
			class="btn preset-filled-primary-500 min-h-12"
			disabled={busy || !order.assignedPartnerId}
			onclick={onstart}
		>
			{text.startDelivery}
		</button>
	{:else if order.status === 'out_for_delivery' && order.assignedPartnerName}
		<p class="text-sm font-medium">{text.withPartner(order.assignedPartnerName)}</p>
	{/if}

	{#if order.status === 'placed' || order.status === 'accepted' || order.status === 'packed'}
		<div class="mt-1 flex gap-2">
			{#if order.status === 'placed'}
				<button type="button" class="btn preset-filled-success-500 min-h-12 flex-1" disabled={busy} onclick={onaccept}>
					{text.accept}
				</button>
			{:else if order.status === 'accepted'}
				<button type="button" class="btn preset-filled-primary-500 min-h-12 flex-1" disabled={busy} onclick={onpack}>
					{text.markPacked}
				</button>
			{/if}
			<button
				type="button"
				class="btn preset-tonal-error min-h-12 {order.status === 'packed' ? 'flex-1' : ''}"
				disabled={busy}
				onclick={onreject}
			>
				{order.status === 'placed' ? text.reject : text.cancel}
			</button>
		</div>
	{/if}
</article>
