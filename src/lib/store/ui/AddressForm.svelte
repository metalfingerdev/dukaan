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

<form class="card preset-outlined-surface-300-700 flex flex-col gap-3 p-3" onsubmit={submit}>
	<fieldset class="flex flex-col items-start gap-2">
		<legend class="font-semibold">{strings.address.pinStep}</legend>
		<p class="text-surface-600-400 text-sm">{strings.address.pinWhy}</p>
		{#if pickingPin}
			<div class="w-full">
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
			<p class="text-success-600-400 text-sm" role="status">{strings.address.locationSaved}</p>
			<div class="flex flex-wrap gap-2">
				{#if mapsEnabled}
					<button type="button" class="btn preset-tonal min-h-11" onclick={() => (pickingPin = true)}>
						{strings.address.changePin}
					</button>
					<button type="button" class="btn preset-tonal min-h-11" disabled={suggesting} onclick={suggestFromPin}>
						{suggesting ? strings.address.suggesting : strings.address.suggestFromPin}
					</button>
				{:else}
					<button type="button" class="btn preset-tonal min-h-11" disabled={locating} onclick={useMyLocation}>
						{locating ? strings.address.locating : strings.address.useLocation}
					</button>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an external Maps link -->
					<a
						class="btn preset-tonal min-h-11"
						href="https://www.google.com/maps/search/?api=1&query={encodeURIComponent(`${lat},${lng}`)}"
						target="_blank"
						rel="noopener noreferrer">{strings.address.checkPin}</a
					>
				{/if}
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#if mapsEnabled}
					<button type="button" class="btn preset-filled min-h-11" onclick={() => (pickingPin = true)}>
						{strings.address.setPin}
					</button>
				{/if}
				<button
					type="button"
					class="btn min-h-11 {mapsEnabled ? 'preset-tonal' : 'preset-filled'}"
					disabled={locating}
					onclick={useMyLocation}
				>
					{locating ? strings.address.locating : strings.address.useLocation}
				</button>
			</div>
			<p class="text-surface-600-400 text-sm">{strings.address.pinStandAtDoor}</p>
		{/if}
		{#if locationNote}
			<p class="text-warning-700-300 text-sm" role="status">{locationNote}</p>
		{/if}
	</fieldset>

	<label class="label">
		<span class="label-text">{strings.address.label}</span>
		<input class="input min-h-11" bind:value={label} placeholder={strings.address.labelHint} maxlength="30" required />
	</label>

	<fieldset class="flex flex-wrap gap-2">
		<legend class="label-text mb-1">{strings.address.kind}</legend>
		{#each ['house', 'hostel', 'shop'] as const as option (option)}
			<label class="btn min-h-11 {kind === option ? 'preset-filled' : 'preset-tonal'}">
				<input type="radio" class="sr-only" name="kind" value={option} bind:group={kind} />
				{strings.address.kinds[option]}
			</label>
		{/each}
	</fieldset>

	<label class="label">
		<span class="label-text">{strings.address.line1[kind]}</span>
		<input class="input min-h-11" bind:value={line1} maxlength="200" required />
	</label>

	<label class="label">
		<span class="label-text">{strings.address.area}</span>
		<select class="select min-h-11" bind:value={area} required>
			<option value="" disabled>{strings.address.areaPlaceholder}</option>
			{#each areas as option (option)}
				<option value={option}>{option}</option>
			{/each}
		</select>
	</label>

	<label class="label">
		<span class="label-text">{strings.address.landmark}</span>
		<input class="input min-h-11" bind:value={landmark} maxlength="200" />
	</label>

	<fieldset class="flex flex-wrap gap-2">
		<legend class="label-text mb-1">{strings.address.receiver}</legend>
		{#each [['myself', strings.address.myself], ['other', strings.address.someoneElse]] as const as [who, text] (who)}
			<label class="btn min-h-11 {receiver === who ? 'preset-filled' : 'preset-tonal'}">
				<input
					type="radio"
					class="sr-only"
					name="receiver"
					value={who}
					checked={receiver === who}
					onchange={() => chooseReceiver(who)}
				/>
				{text}
			</label>
		{/each}
	</fieldset>

	<label class="label">
		<span class="label-text">{strings.address.contactName}</span>
		<input class="input min-h-11" bind:value={contactName} maxlength="80" autocomplete="name" required />
	</label>

	<label class="label">
		<span class="label-text">{strings.address.contactPhone}</span>
		<input
			class="input min-h-11"
			bind:value={contactPhone}
			type="tel"
			inputmode="tel"
			autocomplete="tel"
			required
		/>
	</label>

	<label class="label">
		<span class="label-text">{strings.address.mapsLink}</span>
		<input
			class="input min-h-11"
			type="url"
			inputmode="url"
			bind:value={mapsUrl}
			maxlength="500"
			placeholder="https://maps.app.goo.gl/..."
		/>
		<span class="text-surface-600-400 text-xs">{strings.address.mapsLinkHint}</span>
	</label>

	{#if !address?.isDefault}
		<label class="flex items-center gap-2">
			<input type="checkbox" class="checkbox size-5" bind:checked={makeDefault} />
			<span>{strings.address.makeDefaultCheckbox}</span>
		</label>
	{/if}

	{#if error}
		<p class="text-error-600-400 text-sm" role="alert">{error}</p>
	{/if}

	<div class="flex gap-2">
		<button type="submit" class="btn preset-filled min-h-11 flex-1" disabled={saving}>
			{strings.address.save}
		</button>
		<button type="button" class="btn preset-tonal min-h-11" onclick={oncancel}>
			{strings.address.cancel}
		</button>
	</div>
</form>
