<script lang="ts">
	import { screenGroups } from '#lib/demo/screens.js';
</script>

<div class="index">
	<h1>Demo screens</h1>
	<p class="intro">
		One page per real screen, with sample data and bare-bones markup. Replace a page's markup with
		your design; the grey dashed note on each page says what that screen has to do and which real
		route it stands in for. Customer screens are drawn at phone width, admin at desktop width.
		Generic classes (<code>d-btn</code>, <code>d-card</code> ...) live in
		<code>src/lib/demo/demo.css</code>; sample data in <code>src/lib/demo/data.ts</code>.
	</p>
	{#each screenGroups as { group, screens } (group)}
		<h2>{group}</h2>
		<ul>
			{#each screens as [href, label, blurb] (href)}
				<li>
					<a {href}><b>{label}</b><span>{blurb}</span></a>
				</li>
			{/each}
		</ul>
	{/each}
</div>

<style lang="postcss">
	@reference 'src/app.css';

	.index {
		@apply mx-auto flex max-w-3xl flex-col gap-3 p-3 sm:p-4;
	}
	h1 {
		@apply text-2xl font-extrabold;
	}
	h2 {
		@apply mt-3 text-lg font-bold;
	}
	.intro {
		@apply text-text-muted text-sm;
	}
	ul {
		@apply flex flex-col gap-2;
	}
	a {
		@apply edge edge-press rounded-container bg-foreground flex flex-col p-3;
	}
	a span {
		@apply text-text-muted text-sm;
	}
</style>
