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

<ShopPage showCartBar={false}>
	<h1 class="h4">{strings.checkout.title}</h1>

	{#if placed}
		<p class="text-surface-600-400" role="status">{strings.checkout.placing}</p>
	{:else if cart.isLoading || addresses.data === undefined || !info}
		<div class="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
			{#each { length: 3 } as _, i (i)}
				<div class="bg-surface-100-900 h-24 animate-pulse rounded"></div>
			{/each}
		</div>
	{:else if lines.length === 0}
		<div class="flex flex-col items-start gap-3">
			<p class="text-surface-600-400">{strings.cart.empty}</p>
			<a href={resolve('/')} class="btn preset-filled">{strings.cart.keepShopping}</a>
		</div>
	{:else}
		{#if open === false}
			<p class="card preset-tonal-warning p-3 text-sm" role="status">{strings.checkout.closed}</p>
		{/if}

		<section class="flex flex-col gap-2">
			<h2 class="h5">{strings.checkout.address}</h2>
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
				<ul class="flex flex-col gap-2">
					{#each addressList as address (address._id)}
						<li>
							<label
								class="card preset-outlined-surface-300-700 flex min-h-11 cursor-pointer items-start gap-3 p-3"
							>
								<input
									type="radio"
									name="address"
									class="radio mt-1"
									value={address._id}
									checked={selectedAddress?._id === address._id}
									onchange={() => (chosenAddressId = address._id)}
								/>
								<span class="flex flex-col">
									<span class="font-medium">{address.label}</span>
									<span>{address.line1}</span>
									<span class="text-surface-600-400 text-sm">
										{address.area}{#if address.landmark} &middot; {address.landmark}{/if}
									</span>
									<span class="text-surface-600-400 text-sm">{address.contactName}, {address.contactPhone}</span>
								</span>
							</label>
						</li>
					{/each}
				</ul>
				{#if selectedAddress && !areaOk}
					<p class="text-error-600-400 text-sm" role="alert">{strings.checkout.areaGone}</p>
				{:else if selectedAddress && !pinOk}
					<div class="card preset-tonal-warning flex flex-col items-start gap-2 p-3" role="alert">
						<p class="text-sm">{strings.checkout.needPin}</p>
						<button type="button" class="btn preset-filled min-h-11" onclick={() => (pinningAddress = true)}>
							{strings.checkout.addPin}
						</button>
					</div>
				{/if}
				<div class="flex flex-wrap gap-2">
					<button type="button" class="btn preset-tonal min-h-11" onclick={() => (addingAddress = true)}>
						{strings.checkout.addAddress}
					</button>
					<a href={resolve('/account/addresses')} class="btn preset-tonal min-h-11">
						{strings.checkout.manageAddresses}
					</a>
				</div>
			{:else}
				{#if addressList.length === 0}
					<p class="text-surface-600-400 text-sm">{strings.checkout.needAddress}</p>
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

		<section class="flex flex-col gap-2">
			<h2 class="h5">{strings.checkout.delivery}</h2>
			<select class="select min-h-11" bind:value={delivery} aria-label={strings.checkout.delivery}>
				<option value="asap">{strings.checkout.asap(info.etaMinutes)}</option>
				{#each slots as slot (slot)}
					<option value={slot}>{formatSlot(slot, SLOT_MINUTES)}</option>
				{/each}
			</select>
			{#if !slotOk}
				<p class="text-warning-700-300 text-sm" role="alert">{strings.checkout.slotGone}</p>
			{/if}
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="h5">{strings.checkout.payment}</h2>
			<label class="card preset-outlined-surface-300-700 flex min-h-11 cursor-pointer items-center gap-3 p-3">
				<input type="radio" name="payment" class="radio" value="cod" bind:group={payment} />
				<span>{strings.checkout.cod}</span>
			</label>
			<label class="card preset-outlined-surface-300-700 flex min-h-11 cursor-pointer items-start gap-3 p-3">
				<input type="radio" name="payment" class="radio mt-1" value="upi_on_delivery" bind:group={payment} />
				<span class="flex flex-col">
					<span>{strings.checkout.upi}</span>
					<span class="text-surface-600-400 text-sm">{strings.checkout.upiHint}</span>
				</span>
			</label>
			<label class="card preset-outlined-surface-300-700 flex min-h-11 cursor-pointer items-start gap-3 p-3">
				<input type="radio" name="payment" class="radio mt-1" value="online" bind:group={payment} />
				<span class="flex flex-col">
					<span>{strings.checkout.online}</span>
					<span class="text-surface-600-400 text-sm">{strings.checkout.onlineHint}</span>
				</span>
			</label>
		</section>

		<label class="label">
			<span class="label-text">{strings.checkout.note}</span>
			<textarea
				class="textarea"
				rows="2"
				maxlength="300"
				placeholder={strings.checkout.notePlaceholder}
				bind:value={note}
			></textarea>
		</label>

		{#if pricing}
			<CartBill
				{pricing}
				freeDeliveryAbovePaise={info.freeDeliveryAbovePaise}
				minOrderPaise={info.minOrderPaise}
			/>
		{/if}

		{#if problem}
			<div class="card preset-tonal-error flex flex-col gap-2 p-3" role="alert">
				<p class="font-medium">{problem.message}</p>
				{#if problem.lines.length > 0}
					<ul class="list-inside list-disc text-sm">
						{#each problem.lines as line (line)}
							<li>{line}</li>
						{/each}
					</ul>
				{/if}
				{#if problem.fix === 'cart'}
					<a href={resolve('/cart')} class="btn preset-filled min-h-11 self-start">
						{strings.checkout.reviewCart}
					</a>
				{/if}
			</div>
		{/if}

		<button type="button" class="btn preset-filled min-h-12" disabled={!canPlace} onclick={placeOrder}>
			{#if submitting}
				{strings.checkout.placing}
			{:else if pricing}
				{strings.checkout.placeOrder(formatPaise(pricing.totalPaise))}
			{/if}
		</button>
		<a href={resolve('/cart')} class="text-primary-600-400 text-center text-sm">{strings.checkout.backToCart}</a>
	{/if}
</ShopPage>
