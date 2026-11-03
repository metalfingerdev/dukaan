<script lang="ts">
	// SvelteKit
	import { resolve } from '$app/paths';

	// Icons
	import ShieldIcon from '@lucide/svelte/icons/shield';

	// Constants & API
	import { getAuthContext } from '../../auth/context.svelte.js';
	import { useIsAppAdmin } from '../api/admin.svelte.js';
	import { ADMIN_ROUTE } from '../utils/admin.constants.js';

	let { class: className }: { class?: string } = $props();

	const { authConstants } = getAuthContext();
	const admin = useIsAppAdmin();
</script>

<!--
	Navigation link to the admin area (`/admin`). Renders nothing unless the `admin`
	feature is enabled and the current user is an application admin. The root layout
	shows it in the header; the user dashboard is at `/admin/users`.
-->
{#if authConstants.admin && admin.isAppAdmin}
	<a href={resolve(ADMIN_ROUTE)} class={className ?? 'btn preset-tonal gap-2'}>
		<ShieldIcon class="size-4" aria-hidden="true" />
		<span>Admin</span>
	</a>
{/if}
