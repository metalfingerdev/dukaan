<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';

	const client = useConvexClient();
	const partners = useQuery(api.store.admin.delivery.listPartners, {});
	const cash = useQuery(api.store.admin.delivery.cashToSettle, {});
	const text = strings.admin.delivery;

	// A delivery day is the India date of the day's start
	const dayFormatter = new Intl.DateTimeFormat('en-IN', {
		timeZone: 'Asia/Kolkata',
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});

	let name = $state('');
	let phone = $state('');
	let adding = $state(false);
	let message = $state('');
	let busyKey = $state('');

	const describe = (error: unknown) => {
		const data = error instanceof ConvexError ? (error.data as { code?: string; totalPaise?: number }) : null;
		switch (data?.code) {
			case 'INVALID_NAME':
				return text.errors.name;
			case 'INVALID_PHONE':
				return text.errors.phone;
			case 'PHONE_TAKEN':
				return text.errors.taken;
			case 'TOO_MANY_PARTNERS':
				return text.errors.tooMany;
			case 'CASH_CHANGED':
				return text.cashChanged(formatPaise(data.totalPaise ?? 0));
			case 'NOTHING_TO_SETTLE':
				return text.nothingToSettle;
			default:
				return strings.common.error;
		}
	};

	const add = async (event: SubmitEvent) => {
		event.preventDefault();
		message = '';
		adding = true;
		try {
			await client.mutation(api.store.admin.delivery.addPartner, { name, phoneNumber: phone });
			name = '';
			phone = '';
		} catch (error) {
			message = describe(error);
		} finally {
			adding = false;
		}
	};

	const change = async (key: string, run: () => Promise<unknown>) => {
		message = '';
		busyKey = key;
		try {
			await run();
		} catch (error) {
			message = describe(error);
		} finally {
			busyKey = '';
		}
	};

	const setActive = (partnerId: Id<'deliveryPartners'>, isActive: boolean) =>
		change(partnerId, () => client.mutation(api.store.admin.delivery.setPartnerActive, { partnerId, isActive }));

	const settle = (partnerId: Id<'deliveryPartners'>, dayStartMs: number, expectedTotalPaise: number) =>
		change(`${partnerId}:${dayStartMs}`, () =>
			client.mutation(api.store.admin.delivery.settleCash, { partnerId, dayStartMs, expectedTotalPaise })
		);
</script>

<svelte:head>
	<title>{text.title}</title>
</svelte:head>

<h1 class="h3">{text.title}</h1>

{#if message}
	<p class="text-error-600-400 text-sm" role="alert">{message}</p>
{/if}

<section class="flex flex-col gap-3" aria-labelledby="cash-title">
	<div>
		<h2 id="cash-title" class="h5">{text.cashTitle}</h2>
		<p class="text-surface-600-400 text-sm">{text.cashHint}</p>
	</div>
	{#if cash.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if cash.data === undefined}
		<div class="bg-surface-100-900 h-20 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
	{:else if cash.data.length === 0}
		<p class="text-surface-600-400 text-sm">{text.cashEmpty}</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each cash.data as row (row.partner._id)}
				<li class="card preset-outlined-surface-300-700 flex flex-col gap-2 p-3">
					<h3 class="font-semibold">{row.partner.name}</h3>
					<ul class="flex flex-col gap-2">
						{#each row.days as day (day.dayStartMs)}
							<li class="flex flex-wrap items-center justify-between gap-2">
								<span>
									{dayFormatter.format(day.dayStartMs)}
									<span class="text-surface-600-400 text-sm">· {text.orders(day.orderCount)}</span>
								</span>
								<span class="flex items-center gap-3">
									<span class="font-semibold">{formatPaise(day.totalPaise)}</span>
									<button
										type="button"
										class="btn preset-filled-primary-500 min-h-11"
										disabled={busyKey === `${row.partner._id}:${day.dayStartMs}`}
										onclick={() => settle(row.partner._id, day.dayStartMs, day.totalPaise)}
									>
										{busyKey === `${row.partner._id}:${day.dayStartMs}` ? text.settling : text.markSettled}
									</button>
								</span>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="flex flex-col gap-3" aria-labelledby="partners-title">
	<div>
		<h2 id="partners-title" class="h5">{text.partnersTitle}</h2>
		<p class="text-surface-600-400 text-sm">{text.partnersHint}</p>
	</div>

	<form class="card preset-outlined-surface-300-700 flex flex-col gap-3 p-3 sm:flex-row sm:items-end" onsubmit={add}>
		<label class="flex flex-1 flex-col gap-1">
			<span class="text-sm font-medium">{text.name}</span>
			<input class="input min-h-12" type="text" maxlength="60" required autocomplete="off" bind:value={name} />
		</label>
		<label class="flex flex-1 flex-col gap-1">
			<span class="text-sm font-medium">{text.phone}</span>
			<input
				class="input min-h-12"
				type="tel"
				inputmode="numeric"
				required
				autocomplete="off"
				placeholder={text.phonePlaceholder}
				bind:value={phone}
			/>
		</label>
		<button type="submit" class="btn preset-filled-primary-500 min-h-12" disabled={adding}>
			{adding ? text.adding : text.add}
		</button>
	</form>

	{#if partners.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if partners.data === undefined}
		<div class="bg-surface-100-900 h-20 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
	{:else if partners.data.length === 0}
		<p class="text-surface-600-400 text-sm">{text.empty}</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each partners.data as partner (partner._id)}
				<li class="card preset-outlined-surface-300-700 flex flex-wrap items-center justify-between gap-2 p-3">
					<div>
						<p class="font-semibold">{partner.name}</p>
						<p class="text-surface-600-400 text-sm">
							{partner.phoneNumber} · {partner.isActive ? text.active : text.off}
						</p>
					</div>
					<button
						type="button"
						class="btn min-h-11 {partner.isActive ? 'preset-tonal' : 'preset-filled-success-500'}"
						disabled={busyKey === partner._id}
						onclick={() => setActive(partner._id, !partner.isActive)}
					>
						{partner.isActive ? text.switchOff : text.switchOn}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
