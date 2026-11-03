<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import AdminDashboard from '#lib/admin/ui/AdminDashboard.svelte';
	import { strings } from '#lib/store/strings.js';
</script>

<svelte:head>
	<title>{strings.admin.nav.users} | {strings.admin.title}</title>
</svelte:head>

<h1 class="h3">{strings.admin.nav.users}</h1>
<AdminDashboard />
