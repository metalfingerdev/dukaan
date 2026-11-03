<script lang="ts">
	// The admin home until the live order board (roadmap step 2) takes this route. Access is
	// checked by ./+layout.svelte (UX) and by every admin Convex function (security).
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';

	import StoreOpenSwitch from '#lib/store/admin/StoreOpenSwitch.svelte';
	import { strings } from '#lib/store/strings.js';

	const settings = useQuery(api.store.admin.settings.getSettings, {});
	const text = strings.admin;
</script>

<svelte:head>
	<title>{text.title}</title>
</svelte:head>

<h1 class="h3">{text.title}</h1>

{#if settings.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if settings.data === undefined}
	<div class="bg-surface-100-900 h-24 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else}
	<StoreOpenSwitch hours={settings.data.settings} />
{/if}

<p class="text-surface-600-400 text-sm">{text.home.intro}</p>
<ul class="flex flex-col gap-2">
	<li>
		<a href={resolve('/admin/settings')} class="card preset-outlined-surface-300-700 block p-4">
			<span class="font-semibold">{text.nav.settings}</span>
			<span class="text-surface-600-400 block text-sm">{text.home.settingsLink}</span>
		</a>
	</li>
	<li>
		<a href={resolve('/admin/users')} class="card preset-outlined-surface-300-700 block p-4">
			<span class="font-semibold">{text.nav.users}</span>
			<span class="text-surface-600-400 block text-sm">{text.home.usersLink}</span>
		</a>
	</li>
</ul>
