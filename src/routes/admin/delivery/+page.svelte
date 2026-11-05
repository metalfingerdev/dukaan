<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { formatPaise } from '#lib/store/format.js';
	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';

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

<h1 class="title">{text.title}</h1>

{#if message}
	<p class="problem" role="alert">{message}</p>
{/if}

<section class="section" aria-labelledby="cash-title">
	<div>
		<h2 id="cash-title" class="heading">{text.cashTitle}</h2>
		<p class="muted">{text.cashHint}</p>
	</div>
	{#if cash.error}
		<p class="problem">{strings.common.error}</p>
	{:else if cash.data === undefined}
		<div class="bone placeholder" aria-busy="true" aria-label={strings.common.loading}></div>
	{:else if cash.data.length === 0}
		<p class="muted">{text.cashEmpty}</p>
	{:else}
		<ul class="rows">
			{#each cash.data as row (row.partner._id)}
				<li>
					<Card dense>
						<div class="partner">
							<h3 class="name">{row.partner.name}</h3>
							<ul class="days">
								{#each row.days as day (day.dayStartMs)}
									<li class="day">
										<span>
											{dayFormatter.format(day.dayStartMs)}
											<span class="muted">· {text.orders(day.orderCount)}</span>
										</span>
										<span class="settle">
											<b>{formatPaise(day.totalPaise)}</b>
											<Button
												variant="primary"
												disabled={busyKey === `${row.partner._id}:${day.dayStartMs}`}
												onclick={() => settle(row.partner._id, day.dayStartMs, day.totalPaise)}
											>
												{busyKey === `${row.partner._id}:${day.dayStartMs}` ? text.settling : text.markSettled}
											</Button>
										</span>
									</li>
								{/each}
							</ul>
						</div>
					</Card>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="section" aria-labelledby="partners-title">
	<div>
		<h2 id="partners-title" class="heading">{text.partnersTitle}</h2>
		<p class="muted">{text.partnersHint}</p>
	</div>

	<Card dense>
		<form class="add" onsubmit={add}>
			<span class="grow">
				<Field label={text.name}>
					<input type="text" maxlength="60" required autocomplete="off" bind:value={name} />
				</Field>
			</span>
			<span class="grow">
				<Field label={text.phone}>
					<input
						type="tel"
						inputmode="numeric"
						required
						autocomplete="off"
						placeholder={text.phonePlaceholder}
						bind:value={phone}
					/>
				</Field>
			</span>
			<Button type="submit" variant="primary" disabled={adding}>
				{adding ? text.adding : text.add}
			</Button>
		</form>
	</Card>

	{#if partners.error}
		<p class="problem">{strings.common.error}</p>
	{:else if partners.data === undefined}
		<div class="bone placeholder" aria-busy="true" aria-label={strings.common.loading}></div>
	{:else if partners.data.length === 0}
		<p class="muted">{text.empty}</p>
	{:else}
		<ul class="rows">
			{#each partners.data as partner (partner._id)}
				<li>
					<Card dense>
						<div class="line">
							<div>
								<b>{partner.name}</b>
								<p class="muted">
									{partner.phoneNumber} · {partner.isActive ? text.active : text.off}
								</p>
							</div>
							<Button
								variant={partner.isActive ? 'plain' : 'success'}
								disabled={busyKey === partner._id}
								onclick={() => setActive(partner._id, !partner.isActive)}
							>
								{partner.isActive ? text.switchOff : text.switchOn}
							</Button>
						</div>
					</Card>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="postcss">
	@reference 'src/app.css';

	.title {
		@apply text-2xl font-extrabold;
	}
	.section {
		@apply flex max-w-3xl flex-col gap-3;
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
	.rows {
		@apply flex flex-col gap-2;
	}
	.partner {
		@apply flex flex-col gap-2;
	}
	.name {
		@apply font-extrabold;
	}
	.days {
		@apply flex flex-col gap-2;
	}
	.day {
		@apply flex flex-wrap items-center justify-between gap-2;
	}
	.settle {
		@apply flex items-center gap-3;
	}
	.add {
		@apply flex flex-col gap-3 sm:flex-row sm:items-end;
	}
	.grow {
		@apply flex-1;
	}
	.line {
		@apply flex flex-wrap items-center justify-between gap-2;
	}
	.placeholder {
		@apply block h-20 w-full;
	}
</style>
