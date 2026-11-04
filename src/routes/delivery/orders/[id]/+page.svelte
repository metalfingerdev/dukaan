<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PhoneIcon from '@lucide/svelte/icons/phone';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import { ConvexError } from 'convex/values';
	import { toast } from 'svelte-sonner';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';

	import DeliveredDialog from '#lib/store/delivery/DeliveredDialog.svelte';
	import PinPreview from '#lib/store/delivery/PinPreview.svelte';
	import FailedDialog from '#lib/store/delivery/FailedDialog.svelte';
	import { directionsUrl } from '#lib/store/directions.js';
	import { formatDateTime, formatPaise, formatSlot, formatTime } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import { SLOT_MINUTES } from '#convex/model/store/storeProfile.js';

	const text = strings.delivery;
	const client = useConvexClient();
	const orderId = $derived(page.params.id ?? '');
	const result = useQuery(api.store.delivery.getRun, () => ({ orderId }));
	const run = $derived(result.data);

	let busy = $state(false);
	let dialog = $state<'delivered' | 'failed' | null>(null);
	let codeError = $state('');
	// Items ticked off at pickup; local to this phone
	let ticked = $state<Record<string, boolean>>({});

	const errorCode = (error: unknown) =>
		error instanceof ConvexError ? (error.data as { code?: string })?.code : undefined;

	/** Runs a mutation; the button stays busy until the server answers, so nothing looks done early */
	const act = async <T,>(call: () => Promise<T>): Promise<T | undefined> => {
		busy = true;
		try {
			return await call();
		} catch (error) {
			const code = errorCode(error);
			if (code === 'INVALID_TRANSITION' || code === 'ORDER_NOT_FOUND') toast.info(text.moved);
			else if (code === 'PAYMENT_REQUIRED') codeError = text.paymentRequired;
			else toast.error(text.failed);
			dialog = null;
			return undefined;
		} finally {
			busy = false;
		}
	};

	const pickUp = () => act(() => client.mutation(api.store.delivery.pickUp, { orderId }));

	const deliver = async (code: string, paidWith: 'cash' | 'upi' | undefined) => {
		codeError = '';
		const outcome = await act(() => client.mutation(api.store.delivery.markDelivered, { orderId, code, paidWith }));
		if (!outcome) return;
		if (outcome.ok) dialog = null;
		else codeError = outcome.reason === 'WRONG_CODE' ? text.wrongCode : text.tooManyAttempts;
	};

	const fail = async (reason: keyof typeof text.reasons) => {
		if ((await act(() => client.mutation(api.store.delivery.markFailed, { orderId, reason }))) !== undefined) {
			dialog = null;
		}
	};

	const collectLabel = (r: NonNullable<typeof run>) =>
		r.collectPaise === 0
			? text.alreadyPaid
			: r.paymentMethod === 'cod'
				? text.collectCash(formatPaise(r.collectPaise))
				: text.collectUpi(formatPaise(r.collectPaise));
</script>

<svelte:head>
	<title>{run ? text.orderNumber(run.orderNumber) : text.title}</title>
</svelte:head>

<a href={resolve('/delivery')} class="text-primary-600-400 text-sm">&larr; {text.back}</a>

{#if result.error}
	<p class="text-error-600-400 text-sm" role="alert">{strings.common.error}</p>
{:else if run === undefined}
	<div class="bg-surface-100-900 h-40 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if run === null}
	<p class="text-surface-600-400">{text.notFound}</p>
{:else}
	<header class="flex items-baseline justify-between gap-2">
		<h1 class="h3">{text.orderNumber(run.orderNumber)}</h1>
		<span class="badge preset-tonal">{text.status[run.status]}</span>
	</header>

	{#if run.status === 'cancelled'}
		<p class="preset-tonal-error rounded p-3 font-medium">{text.cancelledNote}</p>
	{:else if run.status === 'delivery_failed'}
		<p class="preset-tonal-warning rounded p-3 font-medium">{text.failedNote}</p>
	{:else if run.status === 'delivered' && run.phoneLast4}
		<p class="preset-tonal-success rounded p-3 font-medium">{text.phoneEnding(run.phoneLast4)}</p>
	{/if}

	{#if run.status === 'packed' || run.status === 'out_for_delivery'}
		<p class="card preset-filled-primary-500 p-4 text-2xl font-bold">{collectLabel(run)}</p>
	{/if}

	{#if run.customer}
		<section class="card preset-outlined-surface-300-700 flex flex-col gap-3 p-4">
			<a
				href="tel:{run.customer.phone}"
				class="btn preset-filled-success-500 min-h-14 gap-2 text-lg"
				aria-label={text.call(run.customer.firstName)}
			>
				<PhoneIcon class="size-5" aria-hidden="true" />
				{run.customer.firstName}
			</a>
			<div>
				<p class="font-medium">{run.customer.line1}</p>
				<p>{run.area}</p>
				{#if run.customer.landmark}
					<p class="text-surface-600-400">{text.near} {run.customer.landmark}</p>
				{/if}
				{#if run.slotStartMs}
					<p class="text-surface-600-400 text-sm">{formatSlot(run.slotStartMs, SLOT_MINUTES)}</p>
				{/if}
			</div>
			{#if run.customer.lat !== undefined && run.customer.lng !== undefined}
				<PinPreview
					lat={run.customer.lat}
					lng={run.customer.lng}
					href={directionsUrl({ ...run.customer, area: run.area })}
				/>
			{:else}
				<p class="preset-tonal-warning rounded p-3 text-sm font-medium" role="alert">{text.noPin}</p>
			{/if}
			{#if run.pinUpdatedAt}
				<p class="preset-tonal-primary rounded p-3 text-sm font-medium" role="status">
					{text.pinMoved(formatTime(run.pinUpdatedAt))}
				</p>
			{/if}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an external Maps link -->
			<a
				href={directionsUrl({ ...run.customer, area: run.area })}
				target="_blank"
				rel="noopener noreferrer"
				class="btn preset-tonal min-h-12 gap-2"
			>
				<MapPinIcon class="size-5" aria-hidden="true" />
				{text.maps}
			</a>
			{#if run.customerNote}
				<p class="text-sm"><span class="font-medium">{text.customerNote}:</span> {run.customerNote}</p>
			{/if}
		</section>
	{/if}

	{#if run.status === 'packed'}
		<button type="button" class="btn preset-filled-primary-500 min-h-14 text-lg" disabled={busy} onclick={pickUp}>
			{busy ? text.working : text.pickedUp}
		</button>
	{:else if run.status === 'out_for_delivery'}
		<div class="grid grid-cols-1 gap-2">
			<button
				type="button"
				class="btn preset-filled-success-500 min-h-14 text-lg"
				disabled={busy}
				onclick={() => {
					codeError = '';
					dialog = 'delivered';
				}}
			>
				{text.delivered}
			</button>
			<button type="button" class="btn preset-tonal-error min-h-12" disabled={busy} onclick={() => (dialog = 'failed')}>
				{text.couldntDeliver}
			</button>
		</div>
	{/if}

	<section class="flex flex-col gap-2">
		<h2 class="h5">{text.itemsTitle}</h2>
		<ul class="flex flex-col gap-1">
			{#each run.items as item (item.name + item.unitLabel)}
				<li>
					<label class="flex min-h-11 items-center gap-3">
						<input type="checkbox" class="checkbox size-6" bind:checked={ticked[item.name + item.unitLabel]} />
						<span class={ticked[item.name + item.unitLabel] ? 'line-through opacity-60' : ''}>
							{item.quantity} × {item.name}
							<span class="text-surface-600-400 text-sm">{item.unitLabel}</span>
						</span>
					</label>
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="h5">{text.progress}</h2>
		<ol class="flex flex-col gap-1">
			{#each run.events as event (event.at + event.status)}
				<li class="flex justify-between gap-3 text-sm">
					<span>{text.status[event.status]}{#if event.note} &middot; {event.note}{/if}</span>
					<span class="text-surface-600-400">{formatDateTime(event.at)}</span>
				</li>
			{/each}
		</ol>
	</section>

	<DeliveredDialog
		open={dialog === 'delivered'}
		collectPaise={run.collectPaise}
		method={run.paymentMethod}
		{busy}
		error={codeError}
		onconfirm={deliver}
		onclose={() => (dialog = null)}
	/>
	<FailedDialog open={dialog === 'failed'} {busy} onconfirm={fail} onclose={() => (dialog = null)} />
{/if}
