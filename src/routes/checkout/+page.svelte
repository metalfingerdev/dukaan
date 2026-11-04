<script lang="ts">
	import { resolve } from '$app/paths';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import { SLOT_MINUTES, STORE_NAME } from '#convex/model/store/storeProfile.js';
	import { listSlots } from '#convex/model/store/slots.js';
	import { isOpenNow } from '#convex/model/store/time.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import AddressForm from '#lib/store/ui/AddressForm.svelte';
	import CartBill from '#lib/store/ui/CartBill.svelte';
	import { getCartContext } from '#lib/store/cart.context.js';
	import { effectiveQuantity } from '#lib/store/cart.svelte.js';
	import { describeCheckoutError, type CheckoutProblem } from '#lib/store/checkoutErrors.js';
	import { formatPaise, formatSlot } from '#lib/store/format.js';
	import { createClock } from '#lib/store/now.svelte.js';
	import { useRequireSignIn } from '#lib/store/requireSignIn.svelte.js';
	import { strings } from '#lib/store/strings.js';
	import { gotoApp } from '#lib/primitives/utils/navigation.js';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Choice from '#lib/ui/Choice.svelte';
	import Notice from '#lib/ui/Notice.svelte';

	const auth = useRequireSignIn();
	const client = useConvexClient();
	const cart = getCartContext();
	const clock = createClock();

	// Gating is UX only: this page is private (hooks.server.ts) and `placeOrder` re-checks everything
	const addresses = useQuery(api.store.addresses.listAddresses, () => (auth.isAuthenticated ? {} : 'skip'));
	const user = useQuery(api.users.queries.getActiveUser, () => (auth.isAuthenticated ? {} : 'skip'));

	const defaultName = $derived.by(() => {
		const name = (user.data as { name?: string } | null | undefined)?.name ?? '';
		return /\d{6,}/.test(name) ? '' : name; // a phone-only sign-up has its number as its name
	});
	const defaultPhone = $derived(
		(user.data as { phoneNumber?: string | null } | null | undefined)?.phoneNumber ?? ''
	);

	const info = $derived(cart.storeInfo);
	const pricing = $derived(cart.pricing);
	const lines = $derived(cart.lines.filter((line) => effectiveQuantity(line) > 0));
	const names = $derived(new Map(cart.lines.map((line) => [line.productId as string, line.product.name])));

	const open = $derived(info ? isOpenNow(info, clock.now) : undefined);
	const slots = $derived(info ? listSlots(info, clock.now) : []);

	// One key for this visit to the page: a double tap or a retry after a lost reply can't make a
	// second order, because the server hands back the first one for the same key
	const idempotencyKey = crypto.randomUUID();

	let chosenAddressId = $state<string | null>(null);
	let addingAddress = $state(false);
	// An address saved before pins were required is opened here to add one
	let pinningAddress = $state(false);
	let delivery = $state<'asap' | number>('asap');
	let payment = $state<'cod' | 'upi_on_delivery' | 'online'>('cod');
	let note = $state('');
	let submitting = $state(false);
	let placed = $state(false);
	let problem = $state<CheckoutProblem | null>(null);

	const addressList = $derived(addresses.data ?? []);
	const selectedAddress = $derived(
		addressList.find((address) => address._id === chosenAddressId) ??
			addressList.find((address) => address.isDefault) ??
			addressList[0]
	);
	const pinOk = $derived(selectedAddress?.lat !== undefined && selectedAddress?.lng !== undefined);
	const areaOk = $derived(!!selectedAddress && !!info && info.deliveryAreas.includes(selectedAddress.area));
	const slotOk = $derived(delivery === 'asap' || slots.includes(delivery));
	const meetsMinimum = $derived(!!pricing && !!info && pricing.subtotalPaise >= info.minOrderPaise);
	const canPlace = $derived(
		open === true &&
			!!selectedAddress &&
			areaOk &&
			pinOk &&
			slotOk &&
			meetsMinimum &&
			lines.length > 0 &&
			!!pricing &&
			!submitting &&
			!placed
	);

	const placeOrder = async () => {
		if (!canPlace || !selectedAddress || !pricing) return;
		submitting = true;
		problem = null;
		try {
			const result = await client.mutation(api.store.orders.placeOrder, {
				addressId: selectedAddress._id,
				slotStartMs: delivery === 'asap' ? undefined : delivery,
				paymentMethod: payment,
				note: note.trim() === '' ? undefined : note,
				idempotencyKey,
				expectedTotalPaise: pricing.totalPaise
			});
			placed = true;
			await gotoApp(`${resolve('/orders/[id]', { id: result.orderId })}?placed=1`);
		} catch (error) {
			problem = describeCheckoutError(error, names);
			if (problem.fix === 'slot') delivery = 'asap';
		} finally {
			submitting = false;
		}
	};
</script>

<svelte:head>
	<title>{strings.checkout.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage showCartBar={false} closedNotice={false}>
	<h1 class="title">{strings.checkout.title}</h1>

	<div class="steps">
		{#if placed}
			<p class="muted" role="status">{strings.checkout.placing}</p>
		{:else if cart.isLoading || addresses.data === undefined || !info}
			<!-- The same sections as the loaded page, drawn with placeholders -->
			<div class="section" aria-busy="true" aria-label={strings.common.loading}>
				{#each { length: 3 } as _, i (i)}
					<h2 class="heading"><span class="bone">Section heading</span></h2>
					<span class="block bone"></span>
				{/each}
			</div>
		{:else if lines.length === 0}
			<div class="empty">
				<p class="muted">{strings.cart.empty}</p>
				<Button href={resolve('/')} variant="primary">{strings.cart.keepShopping}</Button>
			</div>
		{:else}
		<div class="main">
			{#if open === false}
				<Notice tone="warn" role="status">{strings.checkout.closed}</Notice>
			{/if}

			<section class="section">
				<h2 class="heading">{strings.checkout.address}</h2>
				{#if pinningAddress && selectedAddress}
					<AddressForm
						areas={info.deliveryAreas}
						address={selectedAddress}
						{defaultName}
						{defaultPhone}
						onsaved={() => (pinningAddress = false)}
						oncancel={() => (pinningAddress = false)}
					/>
				{:else if addressList.length > 0 && !addingAddress}
					<ul class="choices">
						{#each addressList as address (address._id)}
							<li>
								<Choice
									name="address"
									value={address._id}
									checked={selectedAddress?._id === address._id}
									onchange={() => (chosenAddressId = address._id)}
								>
									<b>{address.label}</b>
									<span>{address.line1}</span>
									<span class="small">
										{address.area}{#if address.landmark} &middot; {address.landmark}{/if}
									</span>
									<span class="small">{address.contactName}, {address.contactPhone}</span>
								</Choice>
							</li>
						{/each}
					</ul>
					{#if selectedAddress && !areaOk}
						<p class="problem" role="alert">{strings.checkout.areaGone}</p>
					{:else if selectedAddress && !pinOk}
						<Notice tone="warn" role="alert">
							<p>{strings.checkout.needPin}</p>
							<Button variant="primary" onclick={() => (pinningAddress = true)}>
								{strings.checkout.addPin}
							</Button>
						</Notice>
					{/if}
					<div class="row">
						<Button onclick={() => (addingAddress = true)}>{strings.checkout.addAddress}</Button>
						<Button href={resolve('/account/addresses')}>{strings.checkout.manageAddresses}</Button>
					</div>
				{:else}
					{#if addressList.length === 0}
						<p class="muted">{strings.checkout.needAddress}</p>
					{/if}
					<AddressForm
						areas={info.deliveryAreas}
						{defaultName}
						{defaultPhone}
						onsaved={(id) => {
							chosenAddressId = id;
							addingAddress = false;
						}}
						oncancel={() => (addingAddress = false)}
					/>
				{/if}
			</section>

			<section class="section">
				<h2 class="heading">{strings.checkout.delivery}</h2>
				<Field label={strings.checkout.delivery} hideLabel>
					<select bind:value={delivery}>
						<option value="asap">{strings.checkout.asap(info.etaMinutes)}</option>
						{#each slots as slot (slot)}
							<option value={slot}>{formatSlot(slot, SLOT_MINUTES)}</option>
						{/each}
					</select>
				</Field>
				{#if !slotOk}
					<p class="warning" role="alert">{strings.checkout.slotGone}</p>
				{/if}
			</section>

			<section class="section">
				<h2 class="heading">{strings.checkout.payment}</h2>
				<Choice name="payment" value="cod" checked={payment === 'cod'} onchange={() => (payment = 'cod')}>
					{strings.checkout.cod}
				</Choice>
				<Choice
					name="payment"
					value="upi_on_delivery"
					checked={payment === 'upi_on_delivery'}
					onchange={() => (payment = 'upi_on_delivery')}
				>
					{strings.checkout.upi}
					<span class="small">{strings.checkout.upiHint}</span>
				</Choice>
				<Choice name="payment" value="online" checked={payment === 'online'} onchange={() => (payment = 'online')}>
					{strings.checkout.online}
					<span class="small">{strings.checkout.onlineHint}</span>
				</Choice>
			</section>

			<Field label={strings.checkout.note}>
				<textarea rows="2" maxlength="300" placeholder={strings.checkout.notePlaceholder} bind:value={note}></textarea>
			</Field>

		</div>

		<aside class="summary">
			{#if pricing}
				<CartBill
					{pricing}
					freeDeliveryAbovePaise={info.freeDeliveryAbovePaise}
					minOrderPaise={info.minOrderPaise}
				/>
			{/if}

			{#if problem}
				<Notice tone="bad" role="alert">
					<p class="strong">{problem.message}</p>
					{#if problem.lines.length > 0}
						<ul class="problem-lines">
							{#each problem.lines as line (line)}
								<li>{line}</li>
							{/each}
						</ul>
					{/if}
					{#if problem.fix === 'cart'}
						<Button href={resolve('/cart')} variant="primary">{strings.checkout.reviewCart}</Button>
					{/if}
				</Notice>
			{/if}

			<Button variant="primary" large block disabled={!canPlace} onclick={placeOrder}>
				{#if submitting}
					{strings.checkout.placing}
				{:else if pricing}
					{strings.checkout.placeOrder(formatPaise(pricing.totalPaise))}
				{/if}
			</Button>
			<a href={resolve('/cart')} class="back">{strings.checkout.backToCart}</a>
		</aside>
		{/if}
	</div>
</ShopPage>

<style lang="postcss">
	@reference 'src/app.css';

	.title {
		@apply text-2xl font-extrabold;
	}
	/* A phone: one column. A laptop: the form on the left, the bill and Place order on the right,
	   which stays in view while the form scrolls */
	.steps {
		@apply flex w-full flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,40rem)_22rem] lg:items-start lg:gap-8;
	}
	.main,
	.summary {
		@apply flex min-w-0 flex-col gap-4;
	}
	.summary {
		@apply lg:sticky lg:top-24;
	}
	.section {
		@apply flex flex-col gap-2;
	}
	.heading {
		@apply text-lg font-extrabold;
	}
	.choices {
		@apply flex flex-col gap-2;
	}
	.row {
		@apply flex flex-wrap gap-2;
	}
	.empty {
		@apply flex flex-col items-start gap-3;
	}
	.block {
		@apply block h-24 w-full;
	}
	.muted {
		@apply text-text-muted;
	}
	.small {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.warning {
		@apply text-sm font-semibold text-warning;
	}
	.strong {
		@apply font-bold;
	}
	.problem-lines {
		@apply list-inside list-disc text-sm;
	}
	.back {
		@apply text-center text-sm font-semibold text-primary;
	}
</style>
