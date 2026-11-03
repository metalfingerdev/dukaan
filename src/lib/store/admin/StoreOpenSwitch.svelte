<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { isOpenNow } from '#convex/model/store/time.js';
	import { formatMinuteOfDay } from '#lib/store/format.js';
	import { createClock } from '#lib/store/now.svelte.js';
	import { strings } from '#lib/store/strings.js';

	type Hours = { isOpen: boolean; opensAtMinute: number; closesAtMinute: number };
	let { hours }: { hours: Hours } = $props();

	const client = useConvexClient();
	const clock = createClock();
	const text = strings.admin.openSwitch;

	let busy = $state(false);
	let failed = $state(false);

	const takingOrders = $derived(isOpenNow(hours, clock.now));

	const toggle = async () => {
		busy = true;
		failed = false;
		try {
			await client.mutation(api.store.admin.settings.setStoreOpen, { isOpen: !hours.isOpen });
		} catch {
			failed = true;
		} finally {
			busy = false;
		}
	};
</script>

<section
	class="card flex flex-col gap-3 p-4 {takingOrders
		? 'preset-tonal-success'
		: 'preset-tonal-warning'}"
	aria-labelledby="store-open-title"
>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 id="store-open-title" class="font-semibold">{text.label}</h2>
			<p class="text-sm" role="status">
				{#if takingOrders}
					{text.takingOrders}
				{:else if hours.isOpen}
					{text.outsideHours(formatMinuteOfDay(hours.opensAtMinute), formatMinuteOfDay(hours.closesAtMinute))}
				{:else}
					{text.switchedOff}
				{/if}
			</p>
		</div>
		<button
			type="button"
			class="btn min-h-12 {hours.isOpen ? 'preset-filled-warning-500' : 'preset-filled-success-500'}"
			aria-pressed={hours.isOpen}
			disabled={busy}
			onclick={toggle}
		>
			{hours.isOpen ? text.turnOff : text.turnOn}
		</button>
	</div>
	{#if failed}
		<p class="text-error-600-400 text-sm" role="alert">{strings.common.error}</p>
	{/if}
</section>
