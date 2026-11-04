<script lang="ts">
	import * as Dialog from '#lib/primitives/ui/dialog/index.js';
	import { strings } from '#lib/store/strings.js';

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

<Dialog.Root {open} onOpenChange={(details) => !details.open && onclose()}>
	<Dialog.Content class="w-[90%] max-w-md">
		<form
			class="flex w-full flex-col gap-4"
			onsubmit={(event) => {
				event.preventDefault();
				onconfirm(reason);
			}}
		>
			<Dialog.Header>
				<Dialog.Title>{text.failedTitle}</Dialog.Title>
				<Dialog.Description>{text.failedHint}</Dialog.Description>
			</Dialog.Header>

			<fieldset class="flex flex-col gap-2">
				{#each reasons as value (value)}
					<label
						class="btn min-h-12 cursor-pointer justify-start {reason === value ? 'preset-filled-primary-500' : 'preset-tonal'}"
					>
						<input class="sr-only" type="radio" name="failure-reason" {value} bind:group={reason} />
						{text.reasons[value]}
					</label>
				{/each}
			</fieldset>

			<Dialog.Footer class="w-full">
				<Dialog.Close class="btn preset-tonal min-h-12" disabled={busy}>{text.keep}</Dialog.Close>
				<button type="submit" class="btn preset-filled-error-500 min-h-12" disabled={busy}>
					{busy ? text.working : text.confirmFailed}
				</button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
