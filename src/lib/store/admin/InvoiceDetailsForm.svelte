<script lang="ts">
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { financialYear, formatInvoiceNumber } from '#convex/model/store/invoice.js';
	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';

	type Field = 'legalName' | 'addressLine' | 'gstin' | 'invoicePrefix';

	const client = useConvexClient();
	const details = useQuery(api.store.admin.settings.getInvoiceDetails, {});
	const text = strings.admin.invoiceDetails;

	let form = $state({ legalName: '', addressLine: '', gstin: '', invoicePrefix: '' });
	let loaded = $state(false);
	let saving = $state(false);
	let message = $state('');
	let error = $state<{ field: Field | null; text: string } | null>(null);

	// Fill the form once from the saved details; after that it is the admin's to edit
	$effect(() => {
		if (!loaded && details.data) {
			form = { ...details.data, gstin: details.data.gstin ?? '' };
			loaded = true;
		}
	});

	const example = $derived(
		formatInvoiceNumber(form.invoicePrefix.trim().toUpperCase() || 'DK', financialYear(Date.now()), 1)
	);

	const save = async (event: SubmitEvent) => {
		event.preventDefault();
		saving = true;
		message = '';
		error = null;
		try {
			const saved = await client.mutation(api.store.admin.settings.updateInvoiceDetails, {
				legalName: form.legalName,
				addressLine: form.addressLine,
				invoicePrefix: form.invoicePrefix,
				gstin: form.gstin.trim() === '' ? undefined : form.gstin
			});
			form = { ...saved, gstin: saved.gstin ?? '' };
			message = text.saved;
		} catch (err) {
			const data = err instanceof ConvexError ? (err.data as { code?: string; field?: Field }) : null;
			error =
				data?.code === 'INVALID_INVOICE_DETAILS' && data.field
					? { field: data.field, text: text.errors[data.field] }
					: { field: null, text: strings.common.error };
		} finally {
			saving = false;
		}
	};
</script>

<section class="section" aria-labelledby="invoice-details-title">
	<div>
		<h2 id="invoice-details-title" class="heading">{text.title}</h2>
		<p class="muted">{text.hint}</p>
	</div>
	{#if details.error}
		<p class="problem">{strings.common.error}</p>
	{:else if !loaded}
		<div class="bone holder" aria-busy="true" aria-label={strings.common.loading}></div>
	{:else}
		<Card dense>
			<form class="form" onsubmit={save} novalidate>
				<Field label={text.legalName} error={error?.field === 'legalName' ? error.text : undefined}>
					<input bind:value={form.legalName} maxlength="100" required />
				</Field>
				<Field label={text.addressLine} error={error?.field === 'addressLine' ? error.text : undefined}>
					<input bind:value={form.addressLine} maxlength="200" required />
				</Field>
				<Field label={text.gstin} hint={text.gstinHint} error={error?.field === 'gstin' ? error.text : undefined}>
					<input
						class="upper"
						bind:value={form.gstin}
						maxlength="20"
						autocapitalize="characters"
						spellcheck="false"
					/>
				</Field>
				<Field label={text.invoicePrefix} hint={text.prefixHint(example)} error={error?.field === 'invoicePrefix' ? error.text : undefined}>
					<input class="upper" bind:value={form.invoicePrefix} maxlength="3" required />
				</Field>
				<Button type="submit" variant="primary" large disabled={saving}>
					{saving ? text.saving : text.save}
				</Button>
				{#if error && error.field === null}<p class="problem" role="alert">{error.text}</p>{/if}
				{#if message}<p class="message" role="status">{message}</p>{/if}
			</form>
		</Card>
	{/if}
</section>

<style lang="postcss">
	@reference 'src/app.css';

	.section {
		@apply flex flex-col gap-3;
	}
	.heading {
		@apply text-lg font-extrabold;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.message {
		@apply text-sm font-semibold;
	}
	.form {
		@apply flex flex-col items-start gap-3;
	}
	.form :global(.field) {
		@apply w-full;
	}
	.upper {
		@apply uppercase;
	}
	.holder {
		@apply block h-40 w-full;
	}
</style>
