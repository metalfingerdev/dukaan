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
	import UpiQrPay from '#lib/store/ui/UpiQrPay.svelte';
	import PinPreview from '#lib/store/delivery/PinPreview.svelte';
	import FailedDialog from '#lib/store/delivery/FailedDialog.svelte';
	import { directionsUrl } from '#lib/store/directions.js';
	import { formatDateTime, formatPaise, formatSlot, formatTime } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import { SLOT_MINUTES } from '#convex/model/store/storeProfile.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Pill from '#lib/ui/Pill.svelte';
	import Notice from '#lib/ui/Notice.svelte';

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
			else if (code === 'UPI_NOT_CONFIRMED') codeError = text.upiNotConfirmed;
			else toast.error(text.failed);
			dialog = null;
			return undefined;
		} finally {
			busy = false;
		}
	};

	const pickUp = () => act(() => client.mutation(api.store.delivery.pickUp, { orderId }));

	const deliver = async (code: string, paidWith: 'cash' | undefined) => {
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

<a href={resolve('/delivery')} class="back">&larr; {text.back}</a>

{#if result.error}
	<p class="problem" role="alert">{strings.common.error}</p>
{:else if run === undefined}
	<!-- The same blocks as the loaded page, drawn with placeholders -->
	<div class="page" aria-busy="true" aria-label={strings.common.loading}>
		<h1 class="title"><span class="bone">Order #0000</span></h1>
		<span class="block bone"></span>
		<span class="block tall bone"></span>
	</div>
{:else if run === null}
	<p class="muted">{text.notFound}</p>
{:else}
	<div class="page">
		<header class="head">
			<h1 class="title">{text.orderNumber(run.orderNumber)}</h1>
			<Pill tone={run.status === 'delivered' ? 'ok' : run.status === 'cancelled' || run.status === 'delivery_failed' ? 'bad' : 'warn'}>
				{text.status[run.status]}
			</Pill>
		</header>

		{#if run.status === 'cancelled'}
			<Notice tone="bad" role="status">{text.cancelledNote}</Notice>
		{:else if run.status === 'delivery_failed'}
			<Notice tone="warn" role="status">{text.failedNote}</Notice>
		{:else if run.status === 'delivered' && run.phoneLast4}
			<Notice tone="info" role="status">{text.phoneEnding(run.phoneLast4)}</Notice>
		{/if}

		<!-- What to collect is the first and biggest thing the rider reads -->
		{#if run.status === 'packed' || run.status === 'out_for_delivery'}
			<p class="collect">{collectLabel(run)}</p>
		{/if}

		{#if run.status === 'out_for_delivery' && (run.collectPaise > 0 || run.upiQr?.status === 'paid')}
			<UpiQrPay
				qr={run.upiQr}
				amountPaise={run.totalPaise}
				forRider={true}
				request={() => client.mutation(api.store.upi.requestQrAsPartner, { orderId })}
				check={() => client.mutation(api.store.upi.checkPaymentAsPartner, { orderId })}
			/>
		{/if}

		{#if run.customer}
			<Card as="section">
				<div class="customer">
					<Button
						href="tel:{run.customer.phone}"
						variant="success"
						large
						block
						aria-label={text.call(run.customer.firstName)}
					>
						<PhoneIcon class="size-5" aria-hidden="true" />
						{run.customer.firstName}
					</Button>
					<div class="address">
						<p class="line"><b>{run.customer.line1}</b></p>
						<p>{run.area}</p>
						{#if run.customer.landmark}
							<p class="muted">{text.near} {run.customer.landmark}</p>
						{/if}
						{#if run.slotStartMs}
							<p class="muted small">{formatSlot(run.slotStartMs, SLOT_MINUTES)}</p>
						{/if}
					</div>
					{#if run.customer.lat !== undefined && run.customer.lng !== undefined}
						<PinPreview
							lat={run.customer.lat}
							lng={run.customer.lng}
							href={directionsUrl({ ...run.customer, area: run.area })}
						/>
					{:else}
						<Notice tone="warn" role="alert">{text.noPin}</Notice>
					{/if}
					{#if run.pinUpdatedAt}
						<Notice tone="info" role="status">{text.pinMoved(formatTime(run.pinUpdatedAt))}</Notice>
					{/if}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an external Maps link -->
					<Button
						href={directionsUrl({ ...run.customer, area: run.area })}
						target="_blank"
						rel="noopener noreferrer"
						block
						large
					>
						<MapPinIcon class="size-5" aria-hidden="true" />
						{text.maps}
					</Button>
					{#if run.customerNote}
						<p class="small"><b>{text.customerNote}:</b> {run.customerNote}</p>
					{/if}
				</div>
			</Card>
		{/if}

		{#if run.status === 'packed'}
			<Button variant="primary" large block disabled={busy} onclick={pickUp}>
				{busy ? text.working : text.pickedUp}
			</Button>
		{:else if run.status === 'out_for_delivery'}
			<div class="actions">
				<Button
					variant="success"
					large
					block
					disabled={busy}
					onclick={() => {
						codeError = '';
						dialog = 'delivered';
					}}
				>
					{text.delivered}
				</Button>
				<Button variant="danger" block disabled={busy} onclick={() => (dialog = 'failed')}>
					{text.couldntDeliver}
				</Button>
			</div>
		{/if}

		<section class="section">
			<h2 class="heading">{text.itemsTitle}</h2>
			<ul class="items">
				{#each run.items as item (item.name + item.unitLabel)}
					<li>
						<label class="item" class:done={ticked[item.name + item.unitLabel]}>
							<input type="checkbox" bind:checked={ticked[item.name + item.unitLabel]} />
							<span>
								{item.quantity} × {item.name}
								<span class="muted small">{item.unitLabel}</span>
							</span>
						</label>
					</li>
				{/each}
			</ul>
		</section>

		<section class="section">
			<h2 class="heading">{text.progress}</h2>
			<ol class="events">
				{#each run.events as event (event.at + event.status)}
					<li>
						<span>{text.status[event.status]}{#if event.note} &middot; {event.note}{/if}</span>
						<span class="muted">{formatDateTime(event.at)}</span>
					</li>
				{/each}
			</ol>
		</section>
	</div>

	<DeliveredDialog
		open={dialog === 'delivered'}
		collectPaise={run.collectPaise}
		{busy}
		error={codeError}
		onconfirm={deliver}
		onclose={() => (dialog = null)}
	/>
	<FailedDialog open={dialog === 'failed'} {busy} onconfirm={fail} onclose={() => (dialog = null)} />
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.back {
		@apply text-sm font-semibold text-primary;
	}
	.page {
		@apply flex flex-col gap-4;
	}
	.head {
		@apply flex items-baseline justify-between gap-2;
	}
	.title {
		@apply text-2xl font-extrabold;
	}
	.muted {
		@apply text-text-muted;
	}
	.small {
		@apply text-sm;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.block {
		@apply block h-24 w-full;
	}
	.tall {
		@apply h-48;
	}

	.collect {
		--fill: var(--color-primary);
		@apply edge rounded-container bg-primary p-4 text-3xl leading-tight font-extrabold text-foreground;
	}
	.customer {
		@apply flex flex-col gap-3;
	}
	.address {
		@apply flex flex-col gap-0.5;
	}
	.line {
		@apply text-lg;
	}
	.actions {
		@apply flex flex-col gap-2;
	}
	.section {
		@apply flex flex-col gap-2;
	}
	.heading {
		@apply text-lg font-extrabold;
	}
	.items {
		@apply flex flex-col;
	}
	.item {
		@apply flex min-h-12 items-center gap-3;
	}
	.item input {
		@apply size-6 text-primary;
	}
	.done {
		@apply line-through opacity-60;
	}
	.events {
		@apply flex flex-col gap-1;
	}
	.events li {
		@apply flex justify-between gap-3 text-sm;
	}
</style>
