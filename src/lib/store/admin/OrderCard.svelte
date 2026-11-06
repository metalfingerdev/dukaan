<script lang="ts">
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import { formatAge, formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Pill from '#lib/ui/Pill.svelte';
	import Field from '#lib/ui/Field.svelte';

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
		onrepack: () => void;
	};
	let { order, now, busy, onaccept, onpack, onreject, partners, onassign, onstart, onrepack }: Props = $props();

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

<Card as="article" dense aria-label={text.orderNumber(order.orderNumber)}>
	<div class="order" class:late={waitingTooLong}>
		<header class="head">
			<h3 class="number">{text.orderNumber(order.orderNumber)}</h3>
			<span class="age" class:strong={waitingTooLong}>
				{#if waitingTooLong}{text.waitingLong}:{/if}
				{formatAge(age)}
			</span>
		</header>

		{#if !order.hasPin}
			<span class="self"><Pill tone="warn">{text.noPin}</Pill></span>
		{/if}

		<p class="where">
			{text.items(order.itemCount)} · {order.area}
			{#if order.landmark}<span class="small block">{text.landmark(order.landmark)}</span>{/if}
		</p>

		<ul class="lines">
			{#each order.items.slice(0, SHOWN_ITEMS) as item (item.name + item.unitLabel)}
				<li>{item.quantity} × {item.name} <span class="small">{item.unitLabel}</span></li>
			{/each}
			{#if order.items.length > SHOWN_ITEMS}
				<li class="small">{text.moreItems(order.items.length - SHOWN_ITEMS)}</li>
			{/if}
		</ul>

		{#if order.customerNote}
			<p class="note">{text.note(order.customerNote)}</p>
		{/if}

		<p class="pay">{payment}</p>

		<Button href="tel:{order.contactPhone}" aria-label={text.call(order.contactName)}>
			<PhoneIcon class="size-4" aria-hidden="true" />
			{order.contactName}
		</Button>

		{#if order.status === 'packed'}
			<Field label={text.partnerLabel}>
				<select
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
			</Field>
			<Button variant="primary" block disabled={busy || !order.assignedPartnerId} onclick={onstart}>
				{text.startDelivery}
			</Button>
		{:else if order.status === 'out_for_delivery' && order.assignedPartnerName}
			<p class="strong">{text.withPartner(order.assignedPartnerName)}</p>
		{/if}

		{#if order.status === 'delivery_failed'}
			{#if order.failureNote}<p class="strong">{text.failedBecause(order.failureNote)}</p>{/if}
			{#if order.assignedPartnerName}<p class="small">{text.assignedTo(order.assignedPartnerName)}</p>{/if}
			<div class="actions">
				<Button variant="primary" disabled={busy} onclick={onrepack}>{text.packAgain}</Button>
				<Button variant="danger" disabled={busy} onclick={onreject}>{text.cancel}</Button>
			</div>
		{/if}

		{#if order.status === 'placed' || order.status === 'accepted' || order.status === 'packed'}
			<div class="actions">
				{#if order.status === 'placed'}
					<Button variant="success" disabled={busy} onclick={onaccept}>{text.accept}</Button>
				{:else if order.status === 'accepted'}
					<Button variant="primary" disabled={busy} onclick={onpack}>{text.markPacked}</Button>
				{/if}
				<Button variant="danger" disabled={busy} onclick={onreject}>
					{order.status === 'placed' ? text.reject : text.cancel}
				</Button>
			</div>
		{/if}
	</div>
</Card>

<style lang="postcss">
	@reference 'src/app.css';

	.order {
		@apply flex flex-col gap-2;
	}
	/* An order waiting too long gets a gold wash and a ring, so it is hard to miss */
	.late {
		@apply -m-2.5 rounded-lg bg-secondary-tint p-2.5 outline-2 outline-secondary;
	}
	.head {
		@apply flex items-baseline justify-between gap-2;
	}
	.number {
		@apply font-extrabold;
	}
	.age {
		@apply text-sm text-text-muted;
	}
	.strong {
		@apply font-bold;
	}
	.self {
		@apply self-start;
	}
	.where {
		@apply text-sm;
	}
	.small {
		@apply text-sm text-text-muted;
	}
	.block {
		@apply block;
	}
	.lines {
		@apply text-sm;
	}
	.note {
		@apply text-sm italic;
	}
	.pay {
		@apply font-bold;
	}
	.actions {
		@apply flex gap-2;
	}
	.actions :global(.button) {
		@apply flex-1;
	}
</style>
