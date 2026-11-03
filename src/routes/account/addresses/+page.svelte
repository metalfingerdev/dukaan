<script lang="ts">
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { api } from '#convex/_generated/api.js';
	import { STORE_NAME } from '#convex/model/store/storeProfile.js';

	import ShopPage from '#lib/store/ui/ShopPage.svelte';
	import AddressForm from '#lib/store/ui/AddressForm.svelte';
	import { strings } from '#lib/store/strings.js';

	const auth = useAuth();
	const client = useConvexClient();

	// Gating is UX only: the page is private by default (hooks.server.ts) and every function
	// behind it checks who is signed in.
	const addresses = useQuery(api.store.addresses.listAddresses, () =>
		auth.isAuthenticated ? {} : 'skip'
	);
	const info = useQuery(api.store.catalog.getStoreInfo, {});
	const user = useQuery(api.users.queries.getActiveUser, () => (auth.isAuthenticated ? {} : 'skip'));

	// A phone-only sign-up has its number as its name until the customer sets one
	const defaultName = $derived.by(() => {
		const name = (user.data as { name?: string } | null | undefined)?.name ?? '';
		return /\d{6,}/.test(name) ? '' : name;
	});
	const defaultPhone = $derived(
		(user.data as { phoneNumber?: string | null } | null | undefined)?.phoneNumber ?? ''
	);

	// 'new', an address id being edited, or nothing
	let editing = $state<string | null>(null);
	let failure = $state('');

	const run = async (action: () => Promise<unknown>) => {
		failure = '';
		try {
			await action();
		} catch {
			failure = strings.common.error;
		}
	};
</script>

<svelte:head>
	<title>{strings.address.title} | {STORE_NAME}</title>
</svelte:head>

<ShopPage showCartBar={false}>
	<h1 class="h4">{strings.address.title}</h1>

	{#if addresses.error}
		<p class="text-error-600-400 text-sm">{strings.common.error}</p>
	{:else if addresses.data === undefined || info.data === undefined}
		<div class="bg-surface-100-900 h-24 animate-pulse rounded" aria-busy="true" aria-label="Loading"></div>
	{:else}
		{#if failure}
			<p class="text-error-600-400 text-sm" role="alert">{failure}</p>
		{/if}

		<ul class="flex flex-col gap-3">
			{#each addresses.data as address (address._id)}
				<li>
					{#if editing === address._id && info.data}
						<AddressForm
							areas={info.data.deliveryAreas}
							{address}
							{defaultName}
							{defaultPhone}
							onsaved={() => (editing = null)}
							oncancel={() => (editing = null)}
						/>
					{:else}
						<div class="card preset-outlined-surface-300-700 flex flex-col gap-1 p-3">
							<p class="flex items-center gap-2 font-medium">
								{address.label}
								{#if address.isDefault}
									<span class="badge preset-filled-primary-500 text-xs">{strings.address.isDefault}</span>
								{/if}
							</p>
							<p>{address.line1}</p>
							<p class="text-surface-600-400 text-sm">
								{address.area}{#if address.landmark} &middot; {address.landmark}{/if}
							</p>
							<p class="text-surface-600-400 text-sm">{address.contactName}, {address.contactPhone}</p>
							<div class="mt-2 flex flex-wrap gap-2">
								<button
									type="button"
									class="btn preset-tonal min-h-11"
									onclick={() => (editing = address._id)}>{strings.address.edit}</button
								>
								{#if !address.isDefault}
									<button
										type="button"
										class="btn preset-tonal min-h-11"
										onclick={() =>
											run(() => client.mutation(api.store.addresses.setDefaultAddress, { id: address._id }))}
										>{strings.address.makeDefault}</button
									>
								{/if}
								<button
									type="button"
									class="btn preset-tonal-error min-h-11"
									onclick={() => {
										if (confirm(strings.address.confirmDelete)) {
											void run(() => client.mutation(api.store.addresses.deleteAddress, { id: address._id }));
										}
									}}>{strings.address.delete}</button
								>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		{#if addresses.data.length === 0 && editing !== 'new'}
			<p class="text-surface-600-400">{strings.address.empty}</p>
		{/if}

		{#if editing === 'new' && info.data}
			<AddressForm
				areas={info.data.deliveryAreas}
				{defaultName}
				{defaultPhone}
				onsaved={() => (editing = null)}
				oncancel={() => (editing = null)}
			/>
		{:else if editing === null}
			<button type="button" class="btn preset-filled min-h-11 self-start" onclick={() => (editing = 'new')}>
				{strings.address.add}
			</button>
		{/if}
	{/if}
</ShopPage>
