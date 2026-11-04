<script lang="ts">
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { financialYear, formatInvoiceNumber } from '#convex/model/store/invoice.js';
	import { strings } from '#lib/store/strings.js';

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

{#snippet fieldError(field: Field)}
	{#if error?.field === field}<span class="text-error-600-400 text-sm" role="alert">{error.text}</span>{/if}
{/snippet}

<section class="flex flex-col gap-3" aria-labelledby="invoice-details-title">
	<div>
		<h2 id="invoice-details-title" class="h5">{text.title}</h2>
		<p class="text-surface-600-400 text-sm">{text.hint}</p>
	</div>
	{#if details.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if !loaded}
		<div class="bg-surface-100-900 h-40 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
	{:else}
		<form class="flex flex-col gap-3" onsubmit={save} novalidate>
			<label class="label">
				<span class="label-text">{text.legalName}</span>
				<input class="input min-h-11" bind:value={form.legalName} maxlength="100" required />
				{@render fieldError('legalName')}
			</label>
			<label class="label">
				<span class="label-text">{text.addressLine}</span>
				<input class="input min-h-11" bind:value={form.addressLine} maxlength="200" required />
				{@render fieldError('addressLine')}
			</label>
			<label class="label">
				<span class="label-text">{text.gstin}</span>
				<input
					class="input min-h-11 uppercase"
					bind:value={form.gstin}
					maxlength="20"
					autocapitalize="characters"
					spellcheck="false"
				/>
				<span class="text-surface-600-400 text-xs">{text.gstinHint}</span>
				{@render fieldError('gstin')}
			</label>
			<label class="label">
				<span class="label-text">{text.invoicePrefix}</span>
				<input class="input min-h-11 uppercase" bind:value={form.invoicePrefix} maxlength="3" required />
				<span class="text-surface-600-400 text-xs">{text.prefixHint(example)}</span>
				{@render fieldError('invoicePrefix')}
			</label>
			<button type="submit" class="btn preset-filled-primary-500 min-h-12" disabled={saving}>
				{saving ? text.saving : text.save}
			</button>
			{#if error && error.field === null}<p class="text-error-600-400 text-sm" role="alert">{error.text}</p>{/if}
			{#if message}<p class="text-sm" role="status">{message}</p>{/if}
		</form>
	{/if}
</section>
