<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { strings } from '#lib/store/strings.js';

	const client = useConvexClient();
	const categories = useQuery(api.store.admin.categories.listCategories, {});
	const text = strings.admin.categories;

	let newName = $state('');
	let adding = $state(false);
	let message = $state('');
	// Only one category is renamed at a time
	let renaming = $state<{ id: Id<'categories'>; name: string } | null>(null);
	let busyId = $state<Id<'categories'> | null>(null);

	const describe = (error: unknown) => {
		const data = error instanceof ConvexError ? (error.data as { code?: string }) : null;
		if (data?.code === 'INVALID_CATEGORY') return text.errors.name;
		if (data?.code === 'TOO_MANY_CATEGORIES') return text.errors.tooMany;
		return strings.common.error;
	};

	const add = async (event: SubmitEvent) => {
		event.preventDefault();
		message = '';
		adding = true;
		try {
			await client.mutation(api.store.admin.categories.createCategory, { name: newName });
			newName = '';
		} catch (error) {
			message = describe(error);
		} finally {
			adding = false;
		}
	};

	/** Runs one change to a category, with its row disabled meanwhile */
	const change = async (id: Id<'categories'>, run: () => Promise<unknown>) => {
		message = '';
		busyId = id;
		try {
			await run();
			return true;
		} catch (error) {
			message = describe(error);
			return false;
		} finally {
			busyId = null;
		}
	};

	const saveName = async (category: { _id: Id<'categories'>; isActive: boolean }) => {
		if (!renaming) return;
		const name = renaming.name;
		if (await change(category._id, () =>
			client.mutation(api.store.admin.categories.updateCategory, {
				categoryId: category._id,
				name,
				isActive: category.isActive
			})
		)) renaming = null;
	};
</script>

<svelte:head>
	<title>{text.title} | {strings.admin.title}</title>
</svelte:head>

<h1 class="h3">{text.title}</h1>
<p class="text-surface-600-400 text-sm">{text.intro}</p>

<form class="flex items-end gap-2" onsubmit={add}>
	<label class="label flex-1">
		<span class="label-text">{text.name}</span>
		<input class="input" bind:value={newName} maxlength={40} autocomplete="off" />
	</label>
	<button type="submit" class="btn preset-filled-primary-500 min-h-11" disabled={adding || !newName.trim()}>
		{adding ? text.adding : text.addButton}
	</button>
</form>
{#if message}
	<p class="text-error-600-400 text-sm" role="alert">{message}</p>
{/if}

{#if categories.error}
	<p class="text-error-600-400 text-sm">{strings.common.error}</p>
{:else if categories.data === undefined}
	<div class="bg-surface-100-900 h-48 animate-pulse rounded" aria-busy="true" aria-label={strings.common.loading}></div>
{:else if categories.data.length === 0}
	<p class="text-surface-600-400 text-sm">{text.empty}</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each categories.data as category, index (category._id)}
			<li
				class="card preset-outlined-surface-300-700 flex flex-col gap-2 p-3 {category.isActive ? '' : 'opacity-70'}"
			>
				{#if renaming?.id === category._id}
					<form
						class="flex items-end gap-2"
						onsubmit={(event) => {
							event.preventDefault();
							void saveName(category);
						}}
					>
						<label class="label flex-1">
							<span class="label-text">{text.rename}</span>
							<input class="input" bind:value={renaming.name} maxlength={40} autocomplete="off" />
						</label>
						<button type="submit" class="btn preset-filled-primary-500 min-h-11" disabled={busyId === category._id}>
							{text.save}
						</button>
						<button type="button" class="btn preset-tonal min-h-11" onclick={() => (renaming = null)}>
							{text.cancel}
						</button>
					</form>
				{:else}
					<div class="flex items-center justify-between gap-2">
						<div class="min-w-0">
							<div class="truncate font-semibold">{category.name}</div>
							{#if !category.isActive}
								<div class="text-warning-700-300 text-xs">{text.hidden}</div>
							{/if}
						</div>
						<a
							href="{resolve('/admin/products')}?category={category._id}"
							class="text-primary-600-400 shrink-0 text-sm"
						>
							{text.viewProducts}
						</a>
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							class="btn preset-tonal min-h-11"
							aria-label="{text.moveUp}: {category.name}"
							disabled={index === 0 || busyId === category._id}
							onclick={() =>
								change(category._id, () =>
									client.mutation(api.store.admin.categories.moveCategory, {
										categoryId: category._id,
										direction: 'up'
									})
								)}
						>
							↑
						</button>
						<button
							type="button"
							class="btn preset-tonal min-h-11"
							aria-label="{text.moveDown}: {category.name}"
							disabled={index === categories.data.length - 1 || busyId === category._id}
							onclick={() =>
								change(category._id, () =>
									client.mutation(api.store.admin.categories.moveCategory, {
										categoryId: category._id,
										direction: 'down'
									})
								)}
						>
							↓
						</button>
						<button
							type="button"
							class="btn preset-tonal min-h-11"
							onclick={() => (renaming = { id: category._id, name: category.name })}
						>
							{text.rename}
						</button>
						<button
							type="button"
							class="btn preset-tonal min-h-11"
							aria-label="{category.isActive ? text.hide : text.show}: {category.name}"
							disabled={busyId === category._id}
							onclick={() =>
								change(category._id, () =>
									client.mutation(api.store.admin.categories.updateCategory, {
										categoryId: category._id,
										name: category.name,
										isActive: !category.isActive
									})
								)}
						>
							{category.isActive ? text.hide : text.show}
						</button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
