<script lang="ts">
	import { strings } from '#lib/store/strings.js';
	import Notice from '#lib/ui/Notice.svelte';

	// A delivery must never look done when it isn't, so say plainly when the phone has no connection
	let online = $state(true);
	$effect(() => {
		online = navigator.onLine;
	});
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

{#if !online}
	<Notice tone="warn" role="alert">{strings.delivery.offline}</Notice>
{/if}
