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

<h1 class="title">{text.title}</h1>

{#if runs.error}
	<p class="problem" role="alert">{strings.common.error}</p>
{:else if runs.data === undefined}
	<!-- The same sections as the loaded list, drawn with placeholders -->
	<section class="section" aria-busy="true" aria-label={strings.common.loading}>
		<h2 class="heading"><span class="bone">{text.toPickUp} (0)</span></h2>
		<RunCard />
		<RunCard />
	</section>
{:else}
	<section class="section" aria-labelledby="pickup-title">
		<h2 id="pickup-title" class="heading">{text.toPickUp} ({runs.data.toPickUp.length})</h2>
		{#each runs.data.toPickUp as run (run._id)}
			<RunCard {run} />
		{:else}
			<p class="muted">{text.nothingToPickUp}</p>
		{/each}
	</section>

	<section class="section" aria-labelledby="way-title">
		<h2 id="way-title" class="heading">{text.onTheWay} ({runs.data.onTheWay.length})</h2>
		{#each runs.data.onTheWay as run (run._id)}
			<RunCard {run} />
		{:else}
			<p class="muted">{text.nothingOnTheWay}</p>
		{/each}
	</section>

	<section class="today" aria-labelledby="today-title">
		<h2 id="today-title" class="heading">{text.today}</h2>
		<p>{text.deliveredToday(runs.data.deliveredToday)}</p>
		<p class="cash">
			{text.cashToHandOver}: <b>{formatPaise(runs.data.cashToHandOverPaise)}</b>
		</p>
	</section>
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.title {
		@apply text-2xl font-extrabold;
	}
	.section {
		@apply flex flex-col gap-3;
	}
	.heading {
		@apply text-lg font-extrabold;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.today {
		--fill: var(--color-secondary);
		@apply edge flex flex-col gap-1 rounded-container bg-secondary/25 p-4;
	}
	.cash {
		@apply text-lg;
	}
</style>
