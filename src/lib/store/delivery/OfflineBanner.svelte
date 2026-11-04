<script lang="ts">
	import { strings } from '#lib/store/strings.js';

	// A delivery must never look done when it isn't, so say plainly when the phone has no connection
	let online = $state(true);
	$effect(() => {
		online = navigator.onLine;
	});
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

{#if !online}
	<p class="preset-filled-warning-500 rounded p-3 text-sm font-medium" role="alert">{strings.delivery.offline}</p>
{/if}
