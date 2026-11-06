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
	import Button from '#lib/ui/Button.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';

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
		{ href: '/admin/payments', label: strings.admin.nav.payments },
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
	<p class="problem">{adminResponse.error.message}</p>
{:else if auth.isLoading || !auth.isAuthenticated || isAdmin === undefined}
	<!-- Resolving auth or the admin check: a neutral spinner (no content flash) -->
	<div class="center" role="status" aria-label={strings.common.loading}>
		<Spinner />
	</div>
{:else if isAdmin === false}
	<!--
		Signed in, but not an application admin. A transparent "Access denied" is harmless because
		every admin function checks on the server. To hide that an admin area exists, return a 404
		from a `load` instead.
	-->
	<div class="denied">
		<ShieldAlertIcon class="size-10 text-text-muted" aria-hidden="true" />
		<h1 class="title">{strings.admin.accessDenied}</h1>
		<p class="muted">{strings.admin.accessDeniedHint}</p>
		<Button href={resolve('/')}>{strings.common.backHome}</Button>
	</div>
{:else}
	<div class="admin">
		<nav aria-label={strings.admin.title} class="menu print:hidden">
			{#each nav as item (item.href)}
				<a
					href={resolve(item.href)}
					aria-current={isCurrent(item.href) ? 'page' : undefined}
					class="link"
					class:current={isCurrent(item.href)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
		<div class="content">
			{@render children()}
		</div>
	</div>
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	/* A phone: the menu is a row of tabs that scrolls sideways. A laptop: a column on the left. */
	.admin {
		@apply mx-auto flex w-full max-w-screen-2xl flex-col gap-3 p-3 sm:p-4 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-8 print:max-w-none print:p-0;
	}
	.menu {
		@apply -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0;
	}
	.link {
		@apply flex min-h-11 shrink-0 items-center rounded-lg px-3 font-semibold whitespace-nowrap;
	}
	.link:hover {
		@apply bg-foreground;
	}
	.current {
		--fill: var(--color-primary);
		@apply bg-primary text-foreground;
	}
	.current:hover {
		@apply bg-primary;
	}
	.content {
		@apply flex min-w-0 flex-col gap-4;
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
