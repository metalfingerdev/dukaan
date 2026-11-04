<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
</script>

<Frame
	title="Kit"
	replaces="the shared parts used on every screen"
	wide
	needs={[
		'Show the small parts once, so every screen can reuse them: buttons, fields, pills, banners',
		'Every tap target at least 44px tall; nothing that needs hover',
		'States: loading (skeleton, not a spinner), empty, error, offline, success toast',
		'Overlays: a bottom sheet on phones (cart, filters), a confirm dialog, a toast'
	]}
>
	<h3 class="d-sub">Buttons</h3>
	<div class="d-row">
		<button type="button" class="d-btn d-btn-primary">Primary</button>
		<button type="button" class="d-btn d-btn-accent">Accent</button>
		<button type="button" class="d-btn">Neutral</button>
		<button type="button" class="d-btn d-btn-danger">Danger</button>
		<button type="button" class="d-btn" disabled>Disabled</button>
		<button type="button" class="d-btn d-btn-sm">Small</button>
	</div>

	<h3 class="d-sub">Fields</h3>
	<div class="fields">
		<label class="d-field">Text <input class="d-input" placeholder="Placeholder" /></label>
		<label class="d-field">Select <select class="d-input"><option>Option</option></select></label>
		<label class="d-field">Textarea <textarea class="d-input" rows="2"></textarea></label>
		<label class="d-row"><input type="checkbox" checked /> Checkbox</label>
		<label class="d-row"><input type="radio" checked /> Radio</label>
	</div>

	<h3 class="d-sub">Pills and banners</h3>
	<div class="d-row">
		<span class="d-pill d-pill-ok">Open</span>
		<span class="d-pill d-pill-warn">Only 3 left</span>
		<span class="d-pill d-pill-bad">Out of stock</span>
		<span class="d-pill">Neutral</span>
	</div>
	<p class="d-banner">Info or warning banner: the store is closed right now.</p>

	<h3 class="d-sub">Loading, empty, error</h3>
	<div class="d-grid4">
		{#each [1, 2, 3, 4] as n (n)}<div class="skeleton"></div>{/each}
	</div>
	<div class="d-card-flat">Empty: nothing here yet. <a href="/demo/home">Go shopping</a></div>
	<div class="d-card-flat">Error: something went wrong. <button type="button" class="d-btn d-btn-sm">Try again</button></div>
	<div class="d-card-flat">Offline: you are offline. Your cart is saved on this phone.</div>

	<h3 class="d-sub">Overlays (drawn static)</h3>
	<div class="overlays">
		<div class="d-card sheet">
			<div class="grab"></div>
			<b>Bottom sheet</b>
			<p class="d-muted">Cart drawer, sort and filter, address picker.</p>
		</div>
		<div class="d-card dialog">
			<b>Cancel this order?</b>
			<p class="d-muted">This cannot be undone.</p>
			<div class="d-row"><button type="button" class="d-btn d-btn-danger d-btn-sm">Cancel order</button><button type="button" class="d-btn d-btn-sm">Keep it</button></div>
		</div>
		<div class="d-card toast">Added to cart</div>
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.fields {
		@apply grid gap-3 sm:grid-cols-2;
	}
	.skeleton {
		@apply bg-background border-border-muted rounded-container aspect-[3/4] animate-pulse border-2;
	}
	.overlays {
		@apply grid gap-3 sm:grid-cols-3;
	}
	.sheet {
		@apply rounded-b-none;
	}
	.grab {
		@apply bg-border mx-auto mb-2 h-1.5 w-12 rounded-full;
	}
	.dialog {
		@apply flex flex-col gap-2;
	}
	.toast {
		@apply bg-text text-foreground self-start font-semibold;
	}
</style>
