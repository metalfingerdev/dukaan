<script lang="ts">
	// For a customer whose rider can't find the door: one tap sends where they are standing, and the
	// rider's screen moves the pin live. Uses only the phone's location, so it works without a Maps key.
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { strings } from '../strings.js';

	let { orderId }: { orderId: string } = $props();
	const client = useConvexClient();
	const text = strings.orders;

	let status = $state<'idle' | 'locating' | 'sent' | 'failed'>('idle');

	const send = () => {
		if (!('geolocation' in navigator)) {
			status = 'failed';
			return;
		}
		status = 'locating';
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				try {
					await client.mutation(api.store.orders.updateOrderPin, {
						orderId,
						lat: position.coords.latitude,
						lng: position.coords.longitude
					});
					status = 'sent';
				} catch {
					status = 'failed';
				}
			},
			() => (status = 'failed'),
			{ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
		);
	};
</script>

<section class="card preset-outlined-surface-300-700 flex flex-col items-start gap-2 p-3">
	<p class="text-sm">{text.sendLocationHint}</p>
	<button type="button" class="btn preset-tonal min-h-11" disabled={status === 'locating'} onclick={send}>
		{status === 'locating' ? text.sendingLocation : text.sendLocation}
	</button>
	{#if status === 'sent'}
		<p class="text-success-600-400 text-sm" role="status">{text.locationSent}</p>
	{:else if status === 'failed'}
		<p class="text-warning-700-300 text-sm" role="alert">{text.locationFailed}</p>
	{/if}
</section>
