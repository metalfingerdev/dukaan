<script lang="ts">
	// For a customer whose rider can't find the door: one tap sends where they are standing, and the
	// rider's screen moves the pin live. Uses only the phone's location, so it works without a Maps key.
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { strings } from '../strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';

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

<Card as="section">
	<div class="box">
		<p class="hint">{text.sendLocationHint}</p>
		<Button disabled={status === 'locating'} onclick={send}>
			{status === 'locating' ? text.sendingLocation : text.sendLocation}
		</Button>
		{#if status === 'sent'}
			<p class="sent" role="status">{text.locationSent}</p>
		{:else if status === 'failed'}
			<p class="failed" role="alert">{text.locationFailed}</p>
		{/if}
	</div>
</Card>

<style lang="postcss">
	@reference 'src/app.css';

	.box {
		@apply flex flex-col items-start gap-2;
	}
	.hint {
		@apply text-sm;
	}
	.sent {
		@apply text-sm font-semibold text-success;
	}
	.failed {
		@apply text-sm font-semibold text-warning;
	}
</style>
