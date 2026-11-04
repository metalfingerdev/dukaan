<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		replaces,
		needs,
		wide = false,
		children
	}: {
		title: string;
		/** The real route(s) this mock stands in for */
		replaces: string;
		/** What the screen has to do, in plain words */
		needs: string[];
		/** Admin screens are laid out for a desktop; everything else is designed at phone width */
		wide?: boolean;
		children: Snippet;
	} = $props();
</script>

<section class="frame">
	<aside class="notes">
		<h1>{title}</h1>
		<p class="replaces">Replaces <code>{replaces}</code></p>
		<h2>This screen must</h2>
		<ul>
			{#each needs as need (need)}
				<li>{need}</li>
			{/each}
		</ul>
	</aside>
	<div class="screen" class:wide>
		{@render children()}
	</div>
</section>

<style lang="postcss">
	@reference 'src/app.css';

	.frame {
		/* Room left for the site header and the jump bar above the window */
		--window-height: calc(100dvh - 10rem);
		@apply mx-auto flex max-w-[110rem] flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:items-start lg:justify-center;
	}
	.notes {
		@apply border-border bg-secondary/10 rounded-container flex shrink-0 flex-col gap-2 overflow-y-auto border-2 border-dashed p-3 text-sm lg:w-72;
		max-height: var(--window-height);
	}
	.notes h1 {
		@apply text-lg font-extrabold;
	}
	.notes h2 {
		@apply mt-1 font-bold;
	}
	.notes ul {
		@apply flex list-disc flex-col gap-1 pl-5;
	}
	.replaces {
		@apply text-text-muted;
	}
	/* The window: whatever the screen holds scrolls inside it, like a device. On a small screen
	   it is just a tall box; from lg up it takes the device shape. */
	.screen {
		@apply border-border bg-foreground flex min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain rounded-3xl border-4 p-3 shadow-[6px_6px_0_0_var(--color-border)];
		height: min(var(--window-height), 80dvh);
	}
	.screen:not(.wide) {
		@apply mx-auto w-full max-w-md;
	}
	@media (min-width: 1024px) {
		/* Phone, portrait 9:16 */
		.screen:not(.wide) {
			@apply mx-0 w-auto max-w-none shrink-0;
			height: var(--window-height);
			aspect-ratio: 9 / 16;
		}
		/* Admin, landscape 16:9: as wide as the room allows, never taller than the window */
		.screen.wide {
			@apply flex-1 rounded-xl;
			height: auto;
			aspect-ratio: 16 / 9;
			max-width: calc(var(--window-height) * 16 / 9);
			max-height: var(--window-height);
		}
	}
</style>
