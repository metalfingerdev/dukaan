<script lang="ts">
	import { formatPaise } from '../format.js';
	import { strings } from '../strings.js';

	type Pricing = {
		subtotalPaise: number;
		savingsPaise: number;
		deliveryFeePaise: number;
		smallCartFeePaise: number;
		totalPaise: number;
	};

	let {
		pricing,
		freeDeliveryAbovePaise,
		minOrderPaise
	}: { pricing: Pricing; freeDeliveryAbovePaise: number; minOrderPaise: number } = $props();

	const toFreeDelivery = $derived(
		pricing.deliveryFeePaise > 0 ? freeDeliveryAbovePaise - pricing.subtotalPaise : 0
	);
	const belowMinimum = $derived(pricing.subtotalPaise > 0 && pricing.subtotalPaise < minOrderPaise);
</script>

<!-- The bill, shared by the cart and the checkout page: the same numbers `placeOrder` charges -->
<section class="card preset-outlined-surface-300-700 flex flex-col gap-2 p-3" aria-label="Bill">
	<dl class="flex flex-col gap-1 text-sm">
		<div class="flex justify-between">
			<dt>{strings.cart.itemTotal}</dt>
			<dd>{formatPaise(pricing.subtotalPaise)}</dd>
		</div>
		<div class="flex justify-between">
			<dt>{strings.cart.deliveryFee}</dt>
			<dd>{pricing.deliveryFeePaise === 0 ? strings.cart.free : formatPaise(pricing.deliveryFeePaise)}</dd>
		</div>
		{#if pricing.smallCartFeePaise > 0}
			<div class="flex justify-between">
				<dt>{strings.cart.handlingFee}</dt>
				<dd>{formatPaise(pricing.smallCartFeePaise)}</dd>
			</div>
		{/if}
		{#if pricing.savingsPaise > 0}
			<div class="text-success-600-400 flex justify-between">
				<dt>{strings.cart.youSave}</dt>
				<dd>{formatPaise(pricing.savingsPaise)}</dd>
			</div>
		{/if}
		<div class="border-surface-300-700 mt-1 flex justify-between border-t pt-2 text-base font-semibold">
			<dt>{strings.cart.total}</dt>
			<dd>{formatPaise(pricing.totalPaise)}</dd>
		</div>
	</dl>
	{#if toFreeDelivery > 0}
		<p class="text-sm">{strings.cart.addForFreeDelivery(formatPaise(toFreeDelivery))}</p>
	{/if}
	{#if belowMinimum}
		<p class="text-warning-700-300 text-sm" role="status">
			{strings.cart.minimumOrder(formatPaise(minOrderPaise))}
		</p>
	{/if}
</section>
