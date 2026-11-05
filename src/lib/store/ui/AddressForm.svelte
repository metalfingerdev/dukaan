<script lang="ts">
	import { untrack } from 'svelte';
	import { ConvexError } from 'convex/values';
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { FunctionReturnType } from 'convex/server';

	import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$app/env/public';

	import { loadGoogleMaps, suggestAddress } from '../maps.js';
	import { strings } from '../strings.js';
	import MapPinPicker from './MapPinPicker.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Choice from '#lib/ui/Choice.svelte';
	import Card from '#lib/ui/Card.svelte';

	type SavedAddress = FunctionReturnType<typeof api.store.addresses.listAddresses>[number];
	type Kind = SavedAddress['kind'];

	let {
		areas,
		address,
		defaultName = '',
		defaultPhone = '',
		onsaved,
		oncancel
	}: {
		areas: string[];
		address?: SavedAddress;
		defaultName?: string;
		defaultPhone?: string;
		onsaved: (addressId: string) => void;
		oncancel: () => void;
	} = $props();

	const client = useConvexClient();

	// The fields start from the saved address when editing, otherwise from what we know about the
	// customer, and are then the customer's to change; later changes to the props don't overwrite them
	const seed = untrack(() => ({
		label: address?.label ?? '',
		kind: address?.kind ?? ('house' as Kind),
		line1: address?.line1 ?? '',
		area: address?.area ?? '',
		landmark: address?.landmark ?? '',
		contactName: address?.contactName ?? defaultName,
		contactPhone: address?.contactPhone ?? defaultPhone,
		lat: address?.lat,
		lng: address?.lng,
		mapsUrl: address?.mapsUrl ?? '',
		// A saved address with someone else's name or number was for someone else
		receiver: (address &&
		(address.contactName !== defaultName || address.contactPhone !== defaultPhone)
			? 'other'
			: 'myself') as 'myself' | 'other'
	}));

	let label = $state(seed.label);
	let kind = $state<Kind>(seed.kind);
	let line1 = $state(seed.line1);
	let area = $state(seed.area);
	let landmark = $state(seed.landmark);
	let contactName = $state(seed.contactName);
	let contactPhone = $state(seed.contactPhone);
	let lat = $state<number | undefined>(seed.lat);
	let lng = $state<number | undefined>(seed.lng);
	let mapsUrl = $state(seed.mapsUrl);
	let receiver = $state<'myself' | 'other'>(seed.receiver);
	let makeDefault = $state(false);

	let saving = $state(false);
	let locating = $state(false);
	let locationNote = $state('');
	// The map opens straight away for a new address: the pin is the first thing we ask for
	let pickingPin = $state(Boolean(PUBLIC_GOOGLE_MAPS_API_KEY) && seed.lat === undefined);
	let suggesting = $state(false);
	let error = $state('');

	const hasLocation = $derived(lat !== undefined && lng !== undefined);
	// Without a Maps key the pin comes from the phone's location alone
	const mapsEnabled = Boolean(PUBLIC_GOOGLE_MAPS_API_KEY);

	const chooseReceiver = (who: 'myself' | 'other') => {
		receiver = who;
		contactName = who === 'myself' ? defaultName : '';
		contactPhone = who === 'myself' ? defaultPhone : '';
	};

	// Asks Google for a guess at the address of the pin and puts it in the empty address box. It is
	// only ever a suggestion: the customer edits it, and only their edited text is saved.
	const suggestFromPin = async () => {
		if (lat === undefined || lng === undefined) return;
		suggesting = true;
		locationNote = '';
		const api = await loadGoogleMaps(PUBLIC_GOOGLE_MAPS_API_KEY);
		const text = api ? await suggestAddress(api, { lat, lng }) : null;
		if (text && line1.trim() === '') {
			line1 = text.slice(0, 200);
			locationNote = strings.address.suggestionAdded;
		} else if (!text) {
			locationNote = strings.address.suggestionNone;
		}
		suggesting = false;
	};

	const useMyLocation = () => {
		locationNote = '';
		if (!('geolocation' in navigator)) {
			locationNote = strings.address.locationDenied;
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			(position) => {
				lat = position.coords.latitude;
				lng = position.coords.longitude;
				locating = false;
			},
			() => {
				locationNote = strings.address.locationDenied;
				locating = false;
			},
			{ timeout: 10_000, maximumAge: 60_000 }
		);
	};

	const messageFor = (err: unknown) => {
		if (err instanceof ConvexError && typeof err.data === 'object' && err.data) {
			const { code, field } = err.data as { code?: string; field?: string };
			const errors = strings.address.errors as Record<string, string>;
			if (code === 'INVALID_ADDRESS' && field && errors[field]) return errors[field];
			if (code && errors[code]) return errors[code];
		}
		return strings.common.error;
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		error = '';
		if (!hasLocation) {
			error = strings.address.errors.pin;
			return;
		}
		saving = true;
		try {
			const { addressId } = await client.mutation(api.store.addresses.saveAddress, {
				id: address?._id,
				label,
				kind,
				line1,
				area,
				landmark: landmark.trim() === '' ? undefined : landmark,
				contactName,
				contactPhone,
				lat,
				lng,
				mapsUrl: mapsUrl.trim() === '' ? undefined : mapsUrl,
				makeDefault: makeDefault || undefined
			});
			onsaved(addressId);
		} catch (err) {
			error = messageFor(err);
		} finally {
			saving = false;
		}
	};
</script>

<Card as="div">
<form class="form" onsubmit={submit}>
	<fieldset class="group">
		<legend class="legend">{strings.address.pinStep}</legend>
		<p class="muted">{strings.address.pinWhy}</p>
		{#if pickingPin}
			<div class="picker">
				<MapPinPicker
					start={hasLocation ? { lat: lat!, lng: lng! } : undefined}
					onconfirm={(pin) => {
						lat = pin.lat;
						lng = pin.lng;
						pickingPin = false;
					}}
					oncancel={() => (pickingPin = false)}
				/>
			</div>
		{:else if hasLocation}
			<p class="saved" role="status">{strings.address.locationSaved}</p>
			<div class="row">
				{#if mapsEnabled}
					<Button onclick={() => (pickingPin = true)}>{strings.address.changePin}</Button>
					<Button disabled={suggesting} onclick={suggestFromPin}>
						{suggesting ? strings.address.suggesting : strings.address.suggestFromPin}
					</Button>
				{:else}
					<Button disabled={locating} onclick={useMyLocation}>
						{locating ? strings.address.locating : strings.address.useLocation}
					</Button>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an external Maps link -->
					<Button
						href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent(`${lat},${lng}`)}"
						target="_blank"
						rel="noopener noreferrer">{strings.address.checkPin}</Button
					>
				{/if}
			</div>
		{:else}
			<div class="row">
				{#if mapsEnabled}
					<Button variant="primary" onclick={() => (pickingPin = true)}>
						{strings.address.setPin}
					</Button>
				{/if}
				<Button
					variant={mapsEnabled ? 'plain' : 'primary'}
					disabled={locating}
					onclick={useMyLocation}
				>
					{locating ? strings.address.locating : strings.address.useLocation}
				</Button>
			</div>
			<p class="muted">{strings.address.pinStandAtDoor}</p>
		{/if}
		{#if locationNote}
			<p class="warning" role="status">{locationNote}</p>
		{/if}
	</fieldset>

	<Field label={strings.address.label}>
		<input bind:value={label} placeholder={strings.address.labelHint} maxlength="30" required />
	</Field>

	<fieldset class="group">
		<legend class="legend">{strings.address.kind}</legend>
		<div class="row">
			{#each ['house', 'hostel', 'shop'] as const as option (option)}
				<Choice chip name="kind" value={option} checked={kind === option} onchange={() => (kind = option)}>
					{strings.address.kinds[option]}
				</Choice>
			{/each}
		</div>
	</fieldset>

	<Field label={strings.address.line1[kind]}>
		<input bind:value={line1} maxlength="200" required />
	</Field>

	<Field label={strings.address.area}>
		<select bind:value={area} required>
			<option value="" disabled>{strings.address.areaPlaceholder}</option>
			{#each areas as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
	</Field>

	<Field label={strings.address.landmark}>
		<input bind:value={landmark} maxlength="200" />
	</Field>

	<fieldset class="group">
		<legend class="legend">{strings.address.receiver}</legend>
		<div class="row">
			{#each [['myself', strings.address.myself], ['other', strings.address.someoneElse]] as const as [who, text] (who)}
				<Choice chip name="receiver" value={who} checked={receiver === who} onchange={() => chooseReceiver(who)}>
					{text}
				</Choice>
			{/each}
		</div>
	</fieldset>

	<Field label={strings.address.contactName}>
		<input bind:value={contactName} maxlength="80" autocomplete="name" required />
	</Field>

	<Field label={strings.address.contactPhone}>
		<input bind:value={contactPhone} type="tel" inputmode="tel" autocomplete="tel" required />
	</Field>

	<Field label={strings.address.mapsLink} hint={strings.address.mapsLinkHint}>
		<input
			type="url"
			inputmode="url"
			bind:value={mapsUrl}
			maxlength="500"
			placeholder="https://maps.app.goo.gl/..."
		/>
	</Field>

	{#if !address?.isDefault}
		<label class="check">
			<input type="checkbox" bind:checked={makeDefault} />
			<span>{strings.address.makeDefaultCheckbox}</span>
		</label>
	{/if}

	{#if error}
		<p class="problem" role="alert">{error}</p>
	{/if}

	<div class="actions">
		<Button type="submit" variant="primary" large disabled={saving}>
			{strings.address.save}
		</Button>
		<Button large onclick={oncancel}>{strings.address.cancel}</Button>
	</div>
</form>
</Card>

<style lang="postcss">
	@reference 'src/app.css';

	.form {
		@apply flex flex-col gap-4;
	}
	.group {
		@apply flex flex-col items-start gap-2;
	}
	.legend {
		@apply font-extrabold;
	}
	.row {
		@apply flex flex-wrap gap-2;
	}
	.picker {
		@apply w-full;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.saved {
		@apply text-sm font-semibold text-success;
	}
	.warning {
		@apply text-sm font-semibold text-warning;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.check {
		@apply flex min-h-11 items-center gap-3;
	}
	.check input {
		@apply size-5 text-primary;
	}
	.actions {
		@apply flex gap-2;
	}
	.actions :global(button:first-child) {
		@apply flex-1;
	}
</style>
