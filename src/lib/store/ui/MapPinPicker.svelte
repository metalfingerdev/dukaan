<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$app/env/public';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';

	import { findPlace, loadGoogleMaps, type LatLngValue, type MapInstance } from '../maps.js';
	import { strings } from '../strings.js';
	import Button from '#lib/ui/Button.svelte';

	// Used only when the customer has no pin yet: the town, looked up by name, so no coordinates
	// are written into the code
	const TOWN = 'Kothri Kalan, Madhya Pradesh';
	// If even that lookup fails, a view of the whole country; the customer pans from there
	const COUNTRY_VIEW: LatLngValue = { lat: 22.9, lng: 78.6 };

	let {
		start,
		onconfirm,
		oncancel
	}: {
		start?: LatLngValue;
		onconfirm: (pin: LatLngValue) => void;
		oncancel: () => void;
	} = $props();

	let element: HTMLDivElement | undefined = $state();
	let map: MapInstance | undefined;
	let status = $state<'loading' | 'ready' | 'unavailable'>('loading');
	let locating = $state(false);

	onMount(() => {
		void (async () => {
			const api = await loadGoogleMaps(PUBLIC_GOOGLE_MAPS_API_KEY);
			if (!api || !element) {
				status = 'unavailable';
				return;
			}
			const known = start ?? (await findPlace(api, TOWN));
			map = new api.Map(element, {
				center: known ?? COUNTRY_VIEW,
				zoom: start ? 18 : known ? 16 : 5,
				disableDefaultUI: true,
				zoomControl: true,
				// Satellite with labels: in a village, roofs, fields and tracks are easier to recognise
				// than a street map with few named streets
				mapTypeId: 'hybrid',
				gestureHandling: 'greedy' // one finger pans, so the page doesn't need two-finger scrolling
			});
			status = 'ready';
			// A new pin starts where the customer is standing, if the phone allows it
			if (!start) panToMe();
		})();
	});

	const panToMe = () => {
		if (!map || !('geolocation' in navigator)) return;
		locating = true;
		navigator.geolocation.getCurrentPosition(
			(position) => {
				map?.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
				map?.setZoom(18);
				locating = false;
			},
			() => (locating = false),
			{ timeout: 10_000, maximumAge: 60_000 }
		);
	};

	const confirm = () => {
		const center = map?.getCenter();
		if (center) onconfirm({ lat: center.lat(), lng: center.lng() });
	};
</script>

<div class="picker">
	{#if status === 'unavailable'}
		<p class="warning" role="status">{strings.address.mapUnavailable}</p>
		<Button onclick={oncancel}>{strings.address.cancel}</Button>
	{:else}
		<p class="title">{strings.address.pinTitle}</p>
		<!-- The pin stays in the middle and the map moves under it, so the position is whatever is
			at the centre. Its tip is at the exact centre, hence the upward shift. -->
		<div class="map">
			<!-- Left empty on purpose: Google fills this element with its own markup -->
			<div bind:this={element} class="canvas"></div>
			{#if status === 'loading'}
				<p class="loading">{strings.address.mapLoading}</p>
			{:else if status === 'ready'}
				<MapPinIcon class="pin" aria-hidden="true" />
			{/if}
		</div>
		<div class="row">
			<Button variant="primary" disabled={status !== 'ready'} onclick={confirm}>
				{strings.address.usePin}
			</Button>
			<Button disabled={status !== 'ready' || locating} onclick={panToMe}>
				{locating ? strings.address.locating : strings.address.useLocation}
			</Button>
			<Button onclick={oncancel}>{strings.address.cancel}</Button>
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference 'src/app.css';

	.picker {
		@apply flex flex-col gap-2;
	}
	.title {
		@apply text-sm font-bold;
	}
	.warning {
		@apply text-sm font-semibold text-warning;
	}
	.map {
		--fill: var(--color-background);
		@apply edge-flat relative h-72 w-full overflow-hidden rounded-base;
	}
	.canvas {
		@apply size-full bg-background;
	}
	.loading {
		@apply absolute top-0 left-0 p-3 text-sm text-text-muted;
	}
	.map :global(.pin) {
		@apply pointer-events-none absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-full text-primary;
	}
	.row {
		@apply flex flex-wrap gap-2;
	}
</style>
