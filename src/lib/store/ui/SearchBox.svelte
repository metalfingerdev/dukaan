<script lang="ts">
	// SvelteKit
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { gotoApp } from '../../primitives/utils/navigation.js';

	// Icons
	import SearchIcon from '@lucide/svelte/icons/search';

	import { strings } from '../strings.js';

	const DEBOUNCE_MS = 250;

	let value = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;

	const onSearchPage = $derived(page.url.pathname === resolve('/search'));

	// Keep the box in step with the address bar (back button, a link with a query)
	$effect(() => {
		value = page.url.searchParams.get('q') ?? '';
	});

	const go = (replace: boolean) => {
		clearTimeout(timer);
		// reset: false keeps the focus in the box and the scroll position where it is
		void gotoApp(`${resolve('/search')}?q=${encodeURIComponent(value.trim())}`, {
			replace,
			reset: false
		});
	};

	// On the results page results follow what is typed; elsewhere Enter or the button searches
	const onInput = () => {
		if (!onSearchPage) return;
		clearTimeout(timer);
		timer = setTimeout(() => go(true), DEBOUNCE_MS);
	};
</script>

<form
	role="search"
	class="flex gap-2"
	onsubmit={(event) => {
		event.preventDefault();
		go(false);
	}}
>
	<input
		type="search"
		name="q"
		class="input min-h-11 flex-1"
		placeholder={strings.search.placeholder}
		aria-label={strings.search.placeholder}
		autocomplete="off"
		bind:value
		oninput={onInput}
	/>
	<button type="submit" class="btn preset-filled min-h-11 min-w-11" aria-label={strings.search.button}>
		<SearchIcon class="size-5" aria-hidden="true" />
	</button>
</form>
