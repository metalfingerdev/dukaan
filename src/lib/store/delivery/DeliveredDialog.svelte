<script lang="ts">
	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';

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

<Sheet {open} onOpenChange={(next) => !next && onclose()} title={text.deliveredTitle} closeLabel={strings.common.close}>
	<form class="form" onsubmit={submit}>
		<p class="muted">{text.codeHint}</p>

		<Field label={text.codeLabel}>
			<input
				class="code"
				type="text"
				inputmode="numeric"
				autocomplete="off"
				maxlength="4"
				bind:value={code}
				aria-invalid={invalid !== '' || error !== ''}
			/>
		</Field>

		{#if collectPaise > 0}
			<label class="collected">
				<input type="checkbox" bind:checked={collected} />
				<span>{text.collectedCash(formatPaise(collectPaise))}</span>
			</label>
		{/if}

		{#if invalid || error}
			<p class="problem" role="alert">{error || invalid}</p>
		{/if}

		<div class="actions">
			<Button type="submit" variant="success" large block disabled={busy}>
				{busy ? text.confirming : text.confirmDelivered}
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
	.code {
		@apply min-h-14 text-center text-3xl tracking-[0.4em];
	}
	.collected {
		@apply flex min-h-12 items-center gap-3 font-bold;
	}
	.collected input {
		@apply size-6 text-primary;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.actions {
		@apply flex flex-col gap-2;
	}
</style>
