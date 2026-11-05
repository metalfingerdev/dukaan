<script lang="ts">
	import { strings } from '#lib/store/strings.js';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';

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

<Sheet open={order !== null} onOpenChange={(next) => !next && onclose()} title={order ? (order.status === 'placed' ? text.rejectTitle(order.orderNumber) : text.cancelTitle(order.orderNumber)) : ''} closeLabel={strings.common.close}>
	{#if order}
		{@const placed = order.status === 'placed'}
		<form class="form" onsubmit={submit}>
			<p class="muted">{text.rejectHint}</p>

			<div class="quick">
				{#each text.quickReasons as quick (quick)}
					<Button onclick={() => (reason = quick)}>{quick}</Button>
				{/each}
			</div>

			<Field label={text.reasonLabel}>
				<input
					type="text"
					maxlength={MAX_REASON}
					placeholder={text.reasonPlaceholder}
					bind:value={reason}
					aria-invalid={invalid}
				/>
			</Field>
			{#if invalid}
				<p class="problem" role="alert">{text.reasonRequired}</p>
			{/if}

			<div class="actions">
				<Button type="submit" variant="danger" large block disabled={busy}>
					{busy ? text.working : placed ? text.confirmReject : text.confirmCancel}
				</Button>
				<Button block disabled={busy} onclick={onclose}>{text.back}</Button>
			</div>
		</form>
	{/if}
</Sheet>

<style lang="postcss">
	@reference 'src/app.css';

	.form {
		@apply flex flex-col gap-4;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.quick {
		@apply flex flex-wrap gap-2;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.actions {
		@apply flex flex-col gap-2;
	}
</style>
