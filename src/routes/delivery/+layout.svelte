<script lang="ts">
	// Gating for every /delivery page is UX only. The real boundary is `requireDeliveryPartner`,
	// which every delivery Convex function calls.
	import { resolve } from '$app/paths';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';

	import OfflineBanner from '#lib/store/delivery/OfflineBanner.svelte';
	import { useRequireSignIn } from '#lib/store/requireSignIn.svelte.js';
	import { strings } from '#lib/store/strings.js';

	let { children } = $props();
	const auth = useRequireSignIn();
	const roles = useQuery(api.store.access.myRoles, () => (auth.isAuthenticated ? {} : 'skip'));
	const text = strings.delivery;
</script>

{#if roles.error}
	<div class="text-error-600-400 mx-auto max-w-md p-6 text-center text-sm">{strings.common.error}</div>
{:else if auth.isLoading || !auth.isAuthenticated || roles.data === undefined}
	<div class="flex min-h-[60vh] w-full items-center justify-center p-6">
		<div
			class="border-surface-300-700 size-6 animate-spin rounded-full border-2 border-t-transparent"
			role="status"
			aria-label={strings.common.loading}
		></div>
	</div>
{:else if !roles.data.isPartner}
	<div class="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
		<ShieldAlertIcon class="size-10 opacity-60" aria-hidden="true" />
		<div>
			<h1 class="h4">{text.accessDenied}</h1>
			<p class="text-surface-600-400 mt-1 text-sm">{text.accessDeniedHint}</p>
		</div>
		<a href={resolve('/')} class="btn preset-tonal">{strings.common.backHome}</a>
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
		<OfflineBanner />
		{@render children()}
	</div>
{/if}
