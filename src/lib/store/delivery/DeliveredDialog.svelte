<script lang="ts">
	import * as Dialog from '#lib/primitives/ui/dialog/index.js';
	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	type Props = {
		open: boolean;
		/** What is still to collect at the door; 0 when the order is already paid */
		collectPaise: number;
		/** Which way the customer chose to pay, to pre-select the same here */
		method: 'cod' | 'upi_on_delivery';
		busy: boolean;
		/** Shown under the code field after a wrong code or a failed call */
		error: string;
		onconfirm: (code: string, paidWith: 'cash' | 'upi' | undefined) => void;
		onclose: () => void;
	};
	let { open, collectPaise, method, busy, error, onconfirm, onclose }: Props = $props();
	const text = strings.delivery;

	let code = $state('');
	let paidWith = $state<'cash' | 'upi'>('cash');
	let invalid = $state(false);

	$effect(() => {
		if (open) {
			code = '';
			invalid = false;
			paidWith = method === 'upi_on_delivery' ? 'upi' : 'cash';
		}
	});

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		invalid = !/^\d{4}$/.test(code.trim());
		if (!invalid) onconfirm(code.trim(), collectPaise > 0 ? paidWith : undefined);
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
					aria-invalid={invalid || error !== ''}
				/>
			</label>

			{#if collectPaise > 0}
				<fieldset class="flex flex-col gap-2">
					<legend class="text-sm font-medium">{text.howPaid} ({formatPaise(collectPaise)})</legend>
					<div class="grid grid-cols-2 gap-2">
						{#each [['cash', text.paidCash], ['upi', text.paidUpi]] as const as [value, label] (value)}
							<label
								class="btn min-h-12 cursor-pointer {paidWith === value ? 'preset-filled-primary-500' : 'preset-tonal'}"
							>
								<input class="sr-only" type="radio" name="paid-with" {value} bind:group={paidWith} />
								{label}
							</label>
						{/each}
					</div>
				</fieldset>
			{/if}

			{#if invalid || error}
				<p class="text-error-600-400 text-sm" role="alert">{error || text.wrongCode}</p>
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
