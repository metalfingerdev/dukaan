<script lang="ts">
	import { strings } from '#lib/store/strings.js';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Choice from '#lib/ui/Choice.svelte';

	type Reason = keyof typeof strings.delivery.reasons;
	type Props = {
		open: boolean;
		busy: boolean;
		onconfirm: (reason: Reason) => void;
		onclose: () => void;
	};
	let { open, busy, onconfirm, onclose }: Props = $props();
	const text = strings.delivery;
	const reasons = Object.keys(text.reasons) as Reason[];

	let reason = $state<Reason>('not_reachable');
	$effect(() => {
		if (open) reason = 'not_reachable';
	});
</script>

<Sheet {open} onOpenChange={(next) => !next && onclose()} title={text.failedTitle} closeLabel={strings.common.close}>
	<form
		class="form"
		onsubmit={(event) => {
			event.preventDefault();
			onconfirm(reason);
		}}
	>
		<p class="muted">{text.failedHint}</p>

		<fieldset class="reasons">
			{#each reasons as value (value)}
				<Choice name="failure-reason" {value} checked={reason === value} onchange={() => (reason = value)}>
					{text.reasons[value]}
				</Choice>
			{/each}
		</fieldset>

		<div class="actions">
			<Button type="submit" variant="danger" large block disabled={busy}>
				{busy ? text.working : text.confirmFailed}
			</Button>
			<Button block disabled={busy} onclick={onclose}>{text.keep}</Button>
		</div>
	</form>
</Sheet>

<style lang="postcss">
	@reference 'src/app.css';

	.form {
		@apply flex flex-col gap-4;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.reasons {
		@apply flex flex-col gap-2;
	}
	.actions {
		@apply flex flex-col gap-2;
	}
</style>
