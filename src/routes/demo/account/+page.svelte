<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { addresses } from '#lib/demo/data.js';
</script>

<Frame
	title="Addresses"
	replaces="/account/addresses"
	needs={[
		'A card per saved address with label, name, phone, landmark; edit and delete; one is the default',
		'The add/edit form is pin first: "Send my location" or drop a pin on the map, then fill the rest',
		'Landmark and phone are important: the rider phones the customer in a small town',
		'"Myself / Someone else" switch changes who the name and phone belong to',
		'Mark a saved address that has no pin so the customer can fix it'
	]}
>
	<h2 class="d-title">Saved addresses</h2>
	{#each addresses as address (address.id)}
		<div class="d-card d-stack">
			<div class="d-between">
				<b>{address.label}</b>
				{#if !address.pinned}<span class="d-pill d-pill-warn">Needs a pin</span>{/if}
			</div>
			<p>{address.name} &middot; {address.phone}</p>
			<p class="d-muted">{address.line}</p>
			<p class="d-muted">Landmark: {address.landmark}</p>
			<div class="d-row">
				<button type="button" class="d-btn d-btn-sm">Edit</button>
				<button type="button" class="d-btn d-btn-sm d-btn-danger">Delete</button>
			</div>
		</div>
	{/each}

	<h3 class="d-sub">Add an address</h3>
	<div class="d-card d-stack">
		<div class="map">map &middot; drop a pin</div>
		<button type="button" class="d-btn d-btn-accent">Send my location</button>
		<div class="d-row">
			<button type="button" class="d-btn d-btn-sm d-btn-primary">Myself</button>
			<button type="button" class="d-btn d-btn-sm">Someone else</button>
		</div>
		<label class="d-field">Name <input class="d-input" /></label>
		<label class="d-field">Phone <input class="d-input" inputmode="tel" /></label>
		<label class="d-field">Address <input class="d-input" /></label>
		<label class="d-field">Landmark <input class="d-input" /></label>
		<button type="button" class="d-btn d-btn-primary d-btn-block">Save address</button>
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.map {
		@apply bg-background border-border rounded-base flex h-40 items-center justify-center border-2 text-sm;
	}
</style>
