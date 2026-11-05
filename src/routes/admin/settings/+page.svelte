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
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Notice from '#lib/ui/Notice.svelte';

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

{#snippet moneyField(field: MoneyField, label: string, hint?: string)}
	<Field {label} {hint} error={errors[field]} errorId="{field}-error">
		<input
			inputmode="decimal"
			autocomplete="off"
			bind:value={form[field]}
			aria-invalid={errors[field] ? 'true' : undefined}
			aria-describedby={errors[field] ? `${field}-error` : undefined}
		/>
	</Field>
{/snippet}

<h1 class="title">{text.title}</h1>

{#if settings.error}
	<p class="problem">{strings.common.error}</p>
{:else if settings.data === undefined || !loaded}
	<div class="bone holder" aria-busy="true" aria-label={strings.common.loading}></div>
{:else}
	<div class="page">
		<StoreOpenSwitch hours={settings.data.settings} />

		{#if !settings.data.saved}
			<Notice tone="warn">{text.notSaved}</Notice>
		{/if}

		<form class="form" onsubmit={save} novalidate>
			<Card dense>
				<fieldset class="group">
					<legend class="legend">{text.hoursTitle}</legend>
					<div class="two">
						<Field label={text.opensAt} error={errors.opensAtMinute} errorId="opensAtMinute-error">
							<input
								type="time"
								bind:value={form.opensAtMinute}
								aria-invalid={errors.opensAtMinute || errors.hours ? 'true' : undefined}
							/>
						</Field>
						<Field label={text.closesAt} error={errors.closesAtMinute} errorId="closesAtMinute-error">
							<input
								type="time"
								bind:value={form.closesAtMinute}
								aria-invalid={errors.closesAtMinute || errors.hours ? 'true' : undefined}
							/>
						</Field>
					</div>
					{#if errors.hours}<p class="problem" id="hours-error">{errors.hours}</p>{/if}
					{#if hoursNote}
						<p class="muted">
							{hoursNote.summary}
							{#if hoursNote.pastMidnight}{text.pastMidnight}{/if}
						</p>
					{/if}
					<Field label={text.eta} hint={text.etaHint} error={errors.etaMinutes} errorId="etaMinutes-error">
						<input
							inputmode="numeric"
							bind:value={form.etaMinutes}
							aria-invalid={errors.etaMinutes ? 'true' : undefined}
						/>
					</Field>
				</fieldset>
			</Card>

			<Card dense>
				<fieldset class="group">
					<legend class="legend">{text.areasTitle}</legend>
					<Field label={text.areas} hint={text.areasHint} error={errors.deliveryAreas} errorId="deliveryAreas-error">
						<textarea
							rows={Math.max(4, areaList.length + 1)}
							bind:value={form.deliveryAreas}
							aria-invalid={errors.deliveryAreas ? 'true' : undefined}
						></textarea>
					</Field>
					{#if removedAreas.length > 0}
						<Notice tone="warn" role="status">
							{text.areasRemoved(removedAreas.map((area) => `"${area}"`).join(', '))}
						</Notice>
					{/if}
				</fieldset>
			</Card>

			<Card dense>
				<fieldset class="group two">
					<legend class="legend wide">{text.moneyTitle}</legend>
					{@render moneyField('minOrderPaise', text.minOrder, text.minOrderHint)}
					<span class="gap" aria-hidden="true"></span>
					{@render moneyField('deliveryFeePaise', text.deliveryFee)}
					{@render moneyField('freeDeliveryAbovePaise', text.freeDeliveryAbove, text.freeDeliveryHint)}
					{@render moneyField('smallCartFeePaise', text.smallCartFee)}
					{@render moneyField('smallCartBelowPaise', text.smallCartBelow)}
				</fieldset>
			</Card>

			<Card dense>
				<fieldset class="group">
					<legend class="legend">{text.contactTitle}</legend>
					<Field label={text.storePhone} hint={text.storePhoneHint} error={errors.storePhone} errorId="storePhone-error">
						<input
							type="tel"
							autocomplete="off"
							bind:value={form.storePhone}
							aria-invalid={errors.storePhone ? 'true' : undefined}
						/>
					</Field>
					<Field label={text.upiVpa} hint={text.upiVpaHint} error={errors.upiVpa} errorId="upiVpa-error">
						<input
							autocomplete="off"
							autocapitalize="none"
							spellcheck="false"
							bind:value={form.upiVpa}
							aria-invalid={errors.upiVpa ? 'true' : undefined}
						/>
					</Field>
				</fieldset>
			</Card>

			<div class="submit">
				<Button type="submit" variant="primary" large disabled={saving}>
					{saving ? text.saving : text.save}
				</Button>
				{#if message}
					<p class="message" role="status">{message}</p>
				{/if}
			</div>
		</form>

		<InvoiceDetailsForm />
	</div>
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.title {
		@apply text-2xl font-extrabold;
	}
	.page {
		@apply flex max-w-3xl flex-col gap-4;
	}
	.form {
		@apply flex flex-col gap-4;
	}
	.group {
		@apply flex flex-col gap-3;
	}
	.legend {
		@apply mb-2 font-extrabold;
	}
	.two {
		@apply grid gap-3 sm:grid-cols-2;
	}
	.wide {
		@apply sm:col-span-2;
	}
	.gap {
		@apply hidden sm:block;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.submit {
		@apply flex flex-col items-start gap-2;
	}
	.message {
		@apply text-sm font-semibold;
	}
	.holder {
		@apply block h-64 w-full;
	}
</style>
