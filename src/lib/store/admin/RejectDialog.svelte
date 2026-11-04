<script lang="ts">
	import * as Dialog from '#lib/primitives/ui/dialog/index.js';
	import { strings } from '#lib/store/strings.js';

	type Props = {
		/** The order being rejected, or `null` when the dialog is closed */
		order: { orderNumber: number; status: string } | null;
		busy: boolean;
		onconfirm: (reason: string) => void;
		onclose: () => void;
	};
	let { order, busy, onconfirm, onclose }: Props = $props();

	const text = strings.admin.board;
	const MAX_REASON = 200;

	let reason = $state('');
	let invalid = $state(false);

	// A fresh form for each order
	$effect(() => {
		if (order) {
			reason = '';
			invalid = false;
		}
	});

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		const trimmed = reason.trim();
		invalid = trimmed.length === 0 || trimmed.length > MAX_REASON;
		if (!invalid) onconfirm(trimmed);
	};
</script>

<Dialog.Root open={order !== null} onOpenChange={(details) => !details.open && onclose()}>
	<Dialog.Content class="w-[90%] max-w-md">
		{#if order}
			{@const placed = order.status === 'placed'}
			<form class="flex w-full flex-col gap-4" onsubmit={submit}>
				<Dialog.Header>
					<Dialog.Title>
						{placed ? text.rejectTitle(order.orderNumber) : text.cancelTitle(order.orderNumber)}
					</Dialog.Title>
					<Dialog.Description>{text.rejectHint}</Dialog.Description>
				</Dialog.Header>

				<div class="flex flex-wrap gap-2">
					{#each text.quickReasons as quick (quick)}
						<button type="button" class="btn btn-sm preset-tonal min-h-10" onclick={() => (reason = quick)}>
							{quick}
						</button>
					{/each}
				</div>

				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">{text.reasonLabel}</span>
					<input
						class="input min-h-12"
						type="text"
						maxlength={MAX_REASON}
						placeholder={text.reasonPlaceholder}
						bind:value={reason}
						aria-invalid={invalid}
					/>
					{#if invalid}
						<span class="text-error-600-400 text-sm" role="alert">{text.reasonRequired}</span>
					{/if}
				</label>

				<Dialog.Footer class="w-full">
					<Dialog.Close class="btn preset-tonal min-h-12" disabled={busy}>{text.back}</Dialog.Close>
					<button type="submit" class="btn preset-filled-error-500 min-h-12" disabled={busy}>
						{busy ? text.working : placed ? text.confirmReject : text.confirmCancel}
					</button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
