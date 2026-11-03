<script lang="ts">
	import type { Snippet } from 'svelte';

	import { getCartContext } from '../cart.context.js';
	import StoreStrip from './StoreStrip.svelte';
	import SearchBox from './SearchBox.svelte';
	import CartBar from './CartBar.svelte';

	let { children, showCartBar = true }: { children: Snippet; showCartBar?: boolean } = $props();

	const cart = getCartContext();
</script>

<!-- The frame every storefront page shares: open/closed strip, search, then the page.
	A wrapper component rather than a route group, since a group would rename the "/" route ID
	that the rest of the app passes to resolve(). The bottom padding keeps the last row clear of
	the fixed cart bar. -->
<div
	class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4"
	class:pb-24={showCartBar && cart.count > 0}
>
	<StoreStrip />
	<SearchBox />
	{@render children()}
</div>

{#if showCartBar}
	<CartBar />
{/if}
