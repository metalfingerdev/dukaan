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
	import Button from '#lib/ui/Button.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';

	let { children } = $props();
	const auth = useRequireSignIn();
	const roles = useQuery(api.store.access.myRoles, () => (auth.isAuthenticated ? {} : 'skip'));
	const text = strings.delivery;
</script>

{#if roles.error}
	<p class="problem">{strings.common.error}</p>
{:else if auth.isLoading || !auth.isAuthenticated || roles.data === undefined}
	<div class="center" role="status" aria-label={strings.common.loading}>
		<Spinner />
	</div>
{:else if !roles.data.isPartner}
	<div class="denied">
		<ShieldAlertIcon class="size-10 text-text-muted" aria-hidden="true" />
		<h1 class="title">{text.accessDenied}</h1>
		<p class="muted">{text.accessDeniedHint}</p>
		<Button href={resolve('/')}>{strings.common.backHome}</Button>
	</div>
{:else}
	<div class="rider">
		<OfflineBanner />
		{@render children()}
	</div>
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.rider {
		@apply mx-auto flex w-full max-w-lg flex-col gap-4 p-4 md:max-w-2xl;
	}
	.center {
		@apply flex min-h-[60vh] w-full items-center justify-center p-6;
	}
	.denied {
		@apply mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center;
	}
	.title {
		@apply text-2xl font-extrabold;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply mx-auto max-w-md p-6 text-center text-sm font-semibold text-danger;
	}
</style>
