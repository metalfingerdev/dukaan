<script lang="ts">
	import type { Snippet } from 'svelte';

	import StoreStrip from './StoreStrip.svelte';
	import SearchBox from './SearchBox.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- The frame every storefront page shares: open/closed strip, search, then the page.
	A wrapper component rather than a route group, since a group would rename the "/" route ID
	that the rest of the app passes to resolve(). -->
<div class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
	<StoreStrip />
	<SearchBox />
	{@render children()}
</div>
