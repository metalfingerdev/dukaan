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
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if settings.data === undefined}
	<div class="bg-surface-100-900 h-24 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else}
	<StoreOpenSwitch hours={settings.data.settings} />
{/if}

<OrderBoard />
