<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { SettingsField } from '#convex/model/store/settings.js';

	import InvoiceDetailsForm from '#lib/store/admin/InvoiceDetailsForm.svelte';
	import StoreOpenSwitch from '#lib/store/admin/StoreOpenSwitch.svelte';
	import { minuteToTime, paiseToInput, parseRupees, timeToMinute } from '#lib/store/inputs.js';
	import { strings } from '#lib/store/strings.js';

	const client = useConvexClient();
	const settings = useQuery(api.store.admin.settings.getSettings, {});
	const text = strings.admin.settings;

	const MONEY_FIELDS = [
		'minOrderPaise',
		'deliveryFeePaise',
		'freeDeliveryAbovePaise',
		'smallCartFeePaise',
		'smallCartBelowPaise'
	] as const;
	type MoneyField = (typeof MONEY_FIELDS)[number];

	type Saved = NonNullable<typeof settings.data>['settings'];

	// Everything as the text in its input; converted only when saving
	const emptyForm = {
		opensAtMinute: '',
		closesAtMinute: '',
		etaMinutes: '',
		deliveryAreas: '',
		minOrderPaise: '',
		deliveryFeePaise: '',
		freeDeliveryAbovePaise: '',
		smallCartFeePaise: '',
		smallCartBelowPaise: '',
		storePhone: '',
		upiVpa: ''
	};
	type Form = typeof emptyForm;

	const toForm = (saved: Saved): Form => ({
		opensAtMinute: minuteToTime(saved.opensAtMinute),
		closesAtMinute: minuteToTime(saved.closesAtMinute),
		etaMinutes: String(saved.etaMinutes),
		deliveryAreas: saved.deliveryAreas.join('\n'),
		minOrderPaise: paiseToInput(saved.minOrderPaise),
		deliveryFeePaise: paiseToInput(saved.deliveryFeePaise),
		freeDeliveryAbovePaise: paiseToInput(saved.freeDeliveryAbovePaise),
		smallCartFeePaise: paiseToInput(saved.smallCartFeePaise),
		smallCartBelowPaise: paiseToInput(saved.smallCartBelowPaise),
		storePhone: saved.storePhone ?? '',
		upiVpa: saved.upiVpa ?? ''
	});

	const form = $state<Form>({ ...emptyForm });
	let loaded = $state(false);
	let savedAreas = $state<string[]>([]);
	let errors = $state<Partial<Record<SettingsField, string>>>({});
	let message = $state('');
	let saving = $state(false);

	const load = (saved: Saved) => {
		Object.assign(form, toForm(saved));
		savedAreas = saved.deliveryAreas;
	};

	// Fill the form once. Later changes to the query (another tab saving) don't overwrite typing.
	$effect(() => {
		if (!loaded && settings.data) {
			load(settings.data.settings);
			loaded = true;
		}
	});

	const errorFor = (field: SettingsField) =>
		(MONEY_FIELDS as readonly string[]).includes(field)
			? text.errors.money
			: text.errors[field as Exclude<SettingsField, MoneyField>];

	const areaList = $derived(
		form.deliveryAreas
			.split('\n')
			.map((area) => area.trim().replace(/\s+/g, ' '))
			.filter(Boolean)
	);
	const removedAreas = $derived(savedAreas.filter((area) => !areaList.includes(area)));

	const hoursNote = $derived.by(() => {
		const opens = timeToMinute(form.opensAtMinute);
		const closes = timeToMinute(form.closesAtMinute);
		if (opens === null || closes === null || opens === closes) return null;
		const length = closes > opens ? closes - opens : closes + 24 * 60 - opens;
		const hours = `${Math.floor(length / 60)} h${length % 60 ? ` ${length % 60} min` : ''}`;
		return { summary: text.hoursSummary(hours), pastMidnight: closes < opens };
	});

	/** The mutation's arguments, or the fields that can't be read */
	const parseForm = () => {
		const found: Partial<Record<SettingsField, string>> = {};
		const opensAtMinute = timeToMinute(form.opensAtMinute);
		const closesAtMinute = timeToMinute(form.closesAtMinute);
		if (opensAtMinute === null) found.opensAtMinute = errorFor('opensAtMinute');
		if (closesAtMinute === null) found.closesAtMinute = errorFor('closesAtMinute');

		const etaMinutes = /^\d+$/.test(form.etaMinutes.trim()) ? Number(form.etaMinutes) : null;
		if (etaMinutes === null) found.etaMinutes = errorFor('etaMinutes');

		const money = {} as Record<MoneyField, number>;
		for (const field of MONEY_FIELDS) {
			const paise = parseRupees(form[field]);
			if (paise === null) found[field] = errorFor(field);
			else money[field] = paise;
		}

		if (Object.keys(found).length > 0) return { errors: found };
		return {
			errors: found,
			values: {
				opensAtMinute: opensAtMinute!,
				closesAtMinute: closesAtMinute!,
				etaMinutes: etaMinutes!,
				deliveryAreas: areaList,
				...money,
				storePhone: form.storePhone,
				upiVpa: form.upiVpa
			}
		};
	};

	const save = async (event: SubmitEvent) => {
		event.preventDefault();
		message = '';
		const parsed = parseForm();
		errors = parsed.errors;
		if (!parsed.values) {
			message = text.fixErrors;
			return;
		}
		saving = true;
		try {
			load(await client.mutation(api.store.admin.settings.updateSettings, parsed.values));
			message = text.saved;
		} catch (error) {
			const data = error instanceof ConvexError ? (error.data as { code?: string; field?: string }) : null;
			if (data?.code === 'INVALID_SETTINGS' && data.field) {
				const field = data.field as SettingsField;
				errors = { [field]: errorFor(field) };
				message = text.fixErrors;
			} else {
				message = strings.common.error;
			}
		} finally {
			saving = false;
		}
	};
</script>

<svelte:head>
	<title>{text.title} | {strings.admin.title}</title>
</svelte:head>

{#snippet fieldError(field: SettingsField)}
	{#if errors[field]}
		<span id="{field}-error" class="text-error-600-400 text-sm">{errors[field]}</span>
	{/if}
{/snippet}

{#snippet moneyField(field: MoneyField, label: string, hint?: string)}
	<label class="label">
		<span class="label-text">{label}</span>
		<input
			class="input"
			inputmode="decimal"
			autocomplete="off"
			bind:value={form[field]}
			aria-invalid={errors[field] ? 'true' : undefined}
			aria-describedby={errors[field] ? `${field}-error` : undefined}
		/>
		{#if hint}<span class="text-surface-600-400 text-xs">{hint}</span>{/if}
		{@render fieldError(field)}
	</label>
{/snippet}

<h1 class="h3">{text.title}</h1>

{#if settings.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if settings.data === undefined || !loaded}
	<div class="bg-surface-100-900 h-64 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else}
	<StoreOpenSwitch hours={settings.data.settings} />

	{#if !settings.data.saved}
		<p class="card preset-tonal-warning p-3 text-sm">{text.notSaved}</p>
	{/if}

	<form class="flex flex-col gap-6" onsubmit={save} novalidate>
		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 font-semibold">{text.hoursTitle}</legend>
			<div class="grid grid-cols-2 gap-3">
				<label class="label">
					<span class="label-text">{text.opensAt}</span>
					<input
						class="input"
						type="time"
						bind:value={form.opensAtMinute}
						aria-invalid={errors.opensAtMinute || errors.hours ? 'true' : undefined}
					/>
					{@render fieldError('opensAtMinute')}
				</label>
				<label class="label">
					<span class="label-text">{text.closesAt}</span>
					<input
						class="input"
						type="time"
						bind:value={form.closesAtMinute}
						aria-invalid={errors.closesAtMinute || errors.hours ? 'true' : undefined}
					/>
					{@render fieldError('closesAtMinute')}
				</label>
			</div>
			{@render fieldError('hours')}
			{#if hoursNote}
				<p class="text-surface-600-400 text-sm">
					{hoursNote.summary}
					{#if hoursNote.pastMidnight}{text.pastMidnight}{/if}
				</p>
			{/if}
			<label class="label">
				<span class="label-text">{text.eta}</span>
				<input
					class="input"
					inputmode="numeric"
					bind:value={form.etaMinutes}
					aria-invalid={errors.etaMinutes ? 'true' : undefined}
				/>
				<span class="text-surface-600-400 text-xs">{text.etaHint}</span>
				{@render fieldError('etaMinutes')}
			</label>
		</fieldset>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 font-semibold">{text.areasTitle}</legend>
			<label class="label">
				<span class="label-text">{text.areas}</span>
				<textarea
					class="textarea"
					rows={Math.max(4, areaList.length + 1)}
					bind:value={form.deliveryAreas}
					aria-invalid={errors.deliveryAreas ? 'true' : undefined}
				></textarea>
				<span class="text-surface-600-400 text-xs">{text.areasHint}</span>
				{@render fieldError('deliveryAreas')}
			</label>
			{#if removedAreas.length > 0}
				<p class="card preset-tonal-warning p-3 text-sm" role="status">
					{text.areasRemoved(removedAreas.map((area) => `"${area}"`).join(', '))}
				</p>
			{/if}
		</fieldset>

		<fieldset class="grid gap-3 sm:grid-cols-2">
			<legend class="mb-2 font-semibold">{text.moneyTitle}</legend>
			{@render moneyField('minOrderPaise', text.minOrder, text.minOrderHint)}
			<span class="hidden sm:block"></span>
			{@render moneyField('deliveryFeePaise', text.deliveryFee)}
			{@render moneyField('freeDeliveryAbovePaise', text.freeDeliveryAbove, text.freeDeliveryHint)}
			{@render moneyField('smallCartFeePaise', text.smallCartFee)}
			{@render moneyField('smallCartBelowPaise', text.smallCartBelow)}
		</fieldset>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 font-semibold">{text.contactTitle}</legend>
			<label class="label">
				<span class="label-text">{text.storePhone}</span>
				<input
					class="input"
					type="tel"
					autocomplete="off"
					bind:value={form.storePhone}
					aria-invalid={errors.storePhone ? 'true' : undefined}
				/>
				<span class="text-surface-600-400 text-xs">{text.storePhoneHint}</span>
				{@render fieldError('storePhone')}
			</label>
			<label class="label">
				<span class="label-text">{text.upiVpa}</span>
				<input
					class="input"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					bind:value={form.upiVpa}
					aria-invalid={errors.upiVpa ? 'true' : undefined}
				/>
				<span class="text-surface-600-400 text-xs">{text.upiVpaHint}</span>
				{@render fieldError('upiVpa')}
			</label>
		</fieldset>

		<div class="flex flex-col gap-2">
			<button type="submit" class="btn preset-filled-primary-500 min-h-12" disabled={saving}>
				{saving ? text.saving : text.save}
			</button>
			{#if message}
				<p class="text-sm" role="status">{message}</p>
			{/if}
		</div>
	</form>

	<InvoiceDetailsForm />
{/if}
