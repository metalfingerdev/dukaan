<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { isOpenNow } from '#convex/model/store/time.js';
	import { formatMinuteOfDay } from '#lib/store/format.js';
	import { createClock } from '#lib/store/now.svelte.js';
	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';

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

<section class="switch" class:on={takingOrders} aria-labelledby="store-open-title">
	<div class="row">
		<div>
			<h2 id="store-open-title" class="label">{text.label}</h2>
			<p class="state" role="status">
				{#if takingOrders}
					{text.takingOrders}
				{:else if hours.isOpen}
					{text.outsideHours(formatMinuteOfDay(hours.opensAtMinute), formatMinuteOfDay(hours.closesAtMinute))}
				{:else}
					{text.switchedOff}
				{/if}
			</p>
		</div>
		<Button
			variant={hours.isOpen ? 'plain' : 'success'}
			aria-pressed={hours.isOpen}
			disabled={busy}
			onclick={toggle}
		>
			{hours.isOpen ? text.turnOff : text.turnOn}
		</Button>
	</div>
	{#if failed}
		<p class="problem" role="alert">{strings.common.error}</p>
	{/if}
</section>

<style lang="postcss">
	@reference 'src/app.css';

	/* Green when the store is taking orders, gold when it is not */
	.switch {
		--fill: var(--color-secondary);
		@apply edge-flat flex flex-col gap-2 rounded-container bg-secondary/25 p-3;
	}
	.switch.on {
		--fill: var(--color-success);
		@apply bg-success/15;
	}
	.row {
		@apply flex flex-wrap items-center justify-between gap-3;
	}
	.label {
		@apply font-extrabold;
	}
	.state {
		@apply text-sm;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
</style>
