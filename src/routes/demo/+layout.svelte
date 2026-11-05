<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import '#lib/demo/demo.css';
	import { screenGroups } from '#lib/demo/screens.js';

	let { children } = $props();
</script>

<svelte:head>
	<title>Demo screens</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="demo">
	<nav class="jump" aria-label="Demo screens">
		<a href={resolve('/demo')} class="all">All screens</a>
		{#each screenGroups as { group, screens } (group)}
			{#each screens as [href, label] (href)}
				<a {href} class:here={page.url.pathname === href}>{label}</a>
			{/each}
		{/each}
	</nav>
	{@render children()}
</div>

<style lang="postcss">
	@reference 'src/app.css';

	.jump {
		@apply border-border bg-midground sticky top-0 z-20 flex gap-1 overflow-x-auto border-b-2 p-2 text-sm font-semibold whitespace-nowrap;
	}
	.jump a {
		@apply rounded-base px-2 py-1;
	}
	.jump a.here {
		@apply bg-primary text-foreground;
	}
	.all {
		@apply bg-secondary/30 text-text;
	}
</style>
