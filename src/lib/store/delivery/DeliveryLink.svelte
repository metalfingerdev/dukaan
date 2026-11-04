<script lang="ts">
	// Shows only for delivery partners. UX only: /delivery and every delivery function check access.
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { strings } from '#lib/store/strings.js';

	let { class: className = '' }: { class?: string } = $props();
	const roles = useQuery(api.store.access.myRoles, {});
</script>

{#if roles.data?.isPartner}
	<a href={resolve('/delivery')} class={className}>{strings.delivery.headerLink}</a>
{/if}
