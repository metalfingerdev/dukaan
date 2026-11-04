<script lang="ts">
	import * as Dialog from '#lib/primitives/ui/dialog/index.js';
	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	type Props = {
		open: boolean;
		/**
		 * Cash still to collect at the door; 0 once the order is paid. A UPI payment only counts once
		 * Razorpay confirms it, so it never appears here as a choice.
		 */
		collectPaise: number;
		busy: boolean;
		/** Shown under the code field after a wrong code or a failed call */
		error: string;
		onconfirm: (code: string, paidWith: 'cash' | undefined) => void;
		onclose: () => void;
	};
	let { open, collectPaise, busy, error, onconfirm, onclose }: Props = $props();
	const text = strings.delivery;

	let code = $state('');
	let collected = $state(false);
	let invalid = $state('');

	$effect(() => {
		if (open) {
			code = '';
			collected = false;
			invalid = '';
		}
	});

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		invalid = !/^\d{4}$/.test(code.trim())
			? text.wrongCode
			: collectPaise > 0 && !collected
				? text.paymentRequired
				: '';
		if (!invalid) onconfirm(code.trim(), collectPaise > 0 ? 'cash' : undefined);
	};
</script>

<Dialog.Root {open} onOpenChange={(details) => !details.open && onclose()}>
	<Dialog.Content class="w-[90%] max-w-md">
		<form class="flex w-full flex-col gap-4" onsubmit={submit}>
			<Dialog.Header>
				<Dialog.Title>{text.deliveredTitle}</Dialog.Title>
				<Dialog.Description>{text.codeHint}</Dialog.Description>
			</Dialog.Header>

			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">{text.codeLabel}</span>
				<input
					class="input min-h-14 text-center text-2xl tracking-widest"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					maxlength="4"
					bind:value={code}
					aria-invalid={invalid !== '' || error !== ''}
				/>
			</label>

			{#if collectPaise > 0}
				<label class="flex min-h-12 items-center gap-3">
					<input type="checkbox" class="checkbox size-6" bind:checked={collected} />
					<span class="font-medium">{text.collectedCash(formatPaise(collectPaise))}</span>
				</label>
			{/if}

			{#if invalid || error}
				<p class="text-error-600-400 text-sm" role="alert">{error || invalid}</p>
			{/if}

			<Dialog.Footer class="w-full">
				<Dialog.Close class="btn preset-tonal min-h-12" disabled={busy}>{text.keep}</Dialog.Close>
				<button type="submit" class="btn preset-filled-success-500 min-h-12" disabled={busy}>
					{busy ? text.confirming : text.confirmDelivered}
				</button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
