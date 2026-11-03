<script lang="ts">
	// API
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { isOpenNow } from '#convex/model/store/time.js';

	// Store
	import { createClock } from '../now.svelte.js';
	import { strings } from '../strings.js';

	const info = useQuery(api.store.catalog.getStoreInfo, {});
	const clock = createClock();

	// `undefined` while loading
	const open = $derived(info.data ? isOpenNow(info.data, clock.now) : undefined);
</script>

{#if info.data}
	<div class="flex flex-wrap items-center gap-2 text-sm">
		<span class="badge {open ? 'preset-filled-success-500' : 'preset-filled-error-500'}">
			{open ? strings.store.open : strings.store.closed}
		</span>
		<span class="text-surface-600-400">{strings.store.deliveryIn(info.data.etaMinutes)}</span>
	</div>
	{#if open === false}
		<p class="card preset-tonal-warning p-3 text-sm" role="status">{strings.store.closedBanner}</p>
	{/if}
{:else if info.data === null}
	<p class="text-surface-600-400 text-sm">{strings.store.notSetUp}</p>
{/if}
