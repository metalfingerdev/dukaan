<script lang="ts">
	// The live order board. Access is checked by ./+layout.svelte (UX) and by every admin Convex
	// function (security). The other admin pages are in the layout's nav.
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';

	import OrderBoard from '#lib/store/admin/OrderBoard.svelte';
	import StoreOpenSwitch from '#lib/store/admin/StoreOpenSwitch.svelte';
	import { strings } from '#lib/store/strings.js';

	const settings = useQuery(api.store.admin.settings.getSettings, {});
</script>

<svelte:head>
	<title>{strings.admin.board.title}</title>
</svelte:head>

{#if settings.error}
	<p class="problem">{strings.common.error}</p>
{:else if settings.data === undefined}
	<div class="bone holder" aria-busy="true" aria-label={strings.common.loading}></div>
{:else}
	<StoreOpenSwitch hours={settings.data.settings} />
{/if}

<OrderBoard />

<style lang="postcss">
	@reference 'src/app.css';

	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.holder {
		@apply h-20 w-full;
	}
</style>
