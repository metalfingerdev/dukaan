<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { istDayStartMs } from '#convex/model/store/time.js';

	import RunCard from '#lib/store/delivery/RunCard.svelte';
	import { formatPaise } from '#lib/store/format.js';
	import { createClock } from '#lib/store/now.svelte.js';
	import { strings } from '#lib/store/strings.js';

	const text = strings.delivery;
	const clock = createClock(60_000);
	// Live: an order the admin just handed over appears without a refresh
	const runs = useQuery(api.store.delivery.myRuns, () => ({ dayStartMs: istDayStartMs(clock.now) }));

	// Tell the partner about a new assignment. The first list that loads is the baseline.
	let known: Set<string> | undefined;
	$effect(() => {
		const ids = runs.data?.toPickUp.map((run) => run._id);
		if (!ids) return;
		const fresh = known ? ids.filter((id) => !known!.has(id)) : [];
		known = new Set(ids);
		if (fresh.length === 0) return;
		toast.success(text.newAssignment);
		try {
			navigator.vibrate?.([200, 100, 200]);
		} catch {
			// not every phone or browser can vibrate
		}
	});
</script>

<svelte:head>
	<title>{text.title}</title>
</svelte:head>

<h1 class="h3">{text.title}</h1>

{#if runs.error}
	<p class="text-error-600-400 text-sm" role="alert">{strings.common.error}</p>
{:else if runs.data === undefined}
	<div class="bg-surface-100-900 h-32 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else}
	<section class="flex flex-col gap-2" aria-labelledby="pickup-title">
		<h2 id="pickup-title" class="h5">{text.toPickUp} ({runs.data.toPickUp.length})</h2>
		{#each runs.data.toPickUp as run (run._id)}
			<RunCard {run} />
		{:else}
			<p class="text-surface-600-400 text-sm">{text.nothingToPickUp}</p>
		{/each}
	</section>

	<section class="flex flex-col gap-2" aria-labelledby="way-title">
		<h2 id="way-title" class="h5">{text.onTheWay} ({runs.data.onTheWay.length})</h2>
		{#each runs.data.onTheWay as run (run._id)}
			<RunCard {run} />
		{:else}
			<p class="text-surface-600-400 text-sm">{text.nothingOnTheWay}</p>
		{/each}
	</section>

	<section class="card preset-tonal flex flex-col gap-1 p-4" aria-labelledby="today-title">
		<h2 id="today-title" class="h5">{text.today}</h2>
		<p>{text.deliveredToday(runs.data.deliveredToday)}</p>
		<p class="text-lg font-semibold">
			{text.cashToHandOver}: {formatPaise(runs.data.cashToHandOverPaise)}
		</p>
	</section>
{/if}
