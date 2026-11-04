<script lang="ts">
	// A small, fixed satellite view of the delivery pin, so the rider sees the house and its
	// surroundings before setting off. Tapping it opens directions. Shown only when a Maps key is
	// set; any failure leaves just the Maps button.
	import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$app/env/public';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import { loadGoogleMaps, type MapInstance } from '../maps.js';
	import { strings } from '../strings.js';

	let { lat, lng, href }: { lat: number; lng: number; href: string } = $props();

	let element: HTMLDivElement | undefined = $state();
	let map: MapInstance | undefined;
	let ready = $state(false);
	let failed = $state(!PUBLIC_GOOGLE_MAPS_API_KEY);

	$effect(() => {
		if (failed || !element) return;
		const target = element;
		let cancelled = false;
		void loadGoogleMaps(PUBLIC_GOOGLE_MAPS_API_KEY).then((api) => {
			if (cancelled) return;
			if (!api) {
				failed = true;
				return;
			}
			map = new api.Map(target, {
				center: { lat, lng },
				zoom: 18,
				mapTypeId: 'hybrid',
				disableDefaultUI: true,
				gestureHandling: 'none',
				keyboardShortcuts: false,
				clickableIcons: false
			});
			ready = true;
		});
		return () => (cancelled = true);
	});

	// The customer can move the pin while the rider is on the way: follow it
	$effect(() => {
		map?.setCenter({ lat, lng });
	});
</script>

{#if !failed}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an external Maps link -->
	<a {href} target="_blank" rel="noopener noreferrer" class="relative block h-48 w-full overflow-hidden rounded" aria-label={strings.delivery.pinPreview}>
		<div bind:this={element} class="bg-surface-100-900 pointer-events-none size-full"></div>
		{#if ready}
			<MapPinIcon
				class="text-error-500 pointer-events-none absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-full"
				aria-hidden="true"
			/>
		{/if}
	</a>
{/if}
