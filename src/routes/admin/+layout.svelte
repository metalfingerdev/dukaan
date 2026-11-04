<script lang="ts">
	// SvelteKit
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	// Icons
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';

	// API
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';

	import { useRequireSignIn } from '#lib/store/requireSignIn.svelte.js';
	import { strings } from '#lib/store/strings.js';

	let { children } = $props();

	const auth = useRequireSignIn();

	// `undefined` while loading, `true`/`false` once resolved.
	const adminResponse = useQuery(api.admin.queries.isCurrentUserAdmin, () =>
		auth.isAuthenticated ? {} : 'skip'
	);
	const isAdmin = $derived(adminResponse?.data);

	const nav = [
		{ href: '/admin', label: strings.admin.nav.home },
		{ href: '/admin/products', label: strings.admin.nav.products },
		{ href: '/admin/categories', label: strings.admin.nav.categories },
		{ href: '/admin/delivery', label: strings.admin.nav.delivery },
		{ href: '/admin/orders', label: strings.admin.nav.pastOrders },
		{ href: '/admin/settings', label: strings.admin.nav.settings },
		{ href: '/admin/users', label: strings.admin.nav.users }
	] as const;

	const isCurrent = (href: (typeof nav)[number]['href']) =>
		href === '/admin'
			? page.url.pathname === resolve('/admin')
			: page.url.pathname.startsWith(resolve(href));
</script>

<!--
	Gating for every /admin page is UX only. The real boundary is `requireAppAdmin`, which every
	admin Convex function calls. Signed-out visitors go to sign in and come back here.
-->
{#if adminResponse.error}
	<div class="text-error-600-400 mx-auto max-w-md p-6 text-center text-sm">
		{adminResponse.error.message}
	</div>
{:else if auth.isLoading || !auth.isAuthenticated || isAdmin === undefined}
	<!-- Resolving auth or the admin check → a neutral spinner (no content flash). -->
	<div class="flex min-h-[60vh] w-full items-center justify-center p-6">
		<div
			class="border-surface-300-700 size-6 animate-spin rounded-full border-2 border-t-transparent"
			role="status"
			aria-label={strings.common.loading}
		></div>
	</div>
{:else if isAdmin === false}
	<!--
		Signed in, but not an application admin. A transparent "Access denied" is harmless because
		every admin function checks on the server. To hide that an admin area exists, return a 404
		from a `load` instead.
	-->
	<div
		class="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
	>
		<ShieldAlertIcon class="size-10 opacity-60" aria-hidden="true" />
		<div>
			<h1 class="h4">{strings.admin.accessDenied}</h1>
			<p class="text-surface-600-400 mt-1 text-sm">{strings.admin.accessDeniedHint}</p>
		</div>
		<a href={resolve('/')} class="btn preset-tonal">{strings.common.backHome}</a>
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 print:max-w-none print:p-0">
		<nav aria-label={strings.admin.title} class="-mx-1 flex gap-1 overflow-x-auto print:hidden">
			{#each nav as item (item.href)}
				<a
					href={resolve(item.href)}
					aria-current={isCurrent(item.href) ? 'page' : undefined}
					class="btn min-h-11 shrink-0 {isCurrent(item.href) ? 'preset-filled-primary-500' : 'preset-tonal'}"
				>
					{item.label}
				</a>
			{/each}
		</nav>
		{@render children()}
	</div>
{/if}
