<script lang="ts">
	// Access is checked by ../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { ConvexError } from 'convex/values';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { strings } from '#lib/store/strings.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';

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

<h1 class="title">{text.title}</h1>
<p class="muted">{text.intro}</p>

<form class="add" onsubmit={add}>
	<span class="grow">
		<Field label={text.name}>
			<input bind:value={newName} maxlength={40} autocomplete="off" />
		</Field>
	</span>
	<Button type="submit" variant="primary" disabled={adding || !newName.trim()}>
		{adding ? text.adding : text.addButton}
	</Button>
</form>
{#if message}
	<p class="problem" role="alert">{message}</p>
{/if}

{#if categories.error}
	<p class="problem">{strings.common.error}</p>
{:else if categories.data === undefined}
	<ul class="rows" aria-busy="true" aria-label={strings.common.loading}>
		{#each { length: 4 } as _, i (i)}
			<li aria-hidden="true">
				<Card dense>
					<div class="bone holder"></div>
				</Card>
			</li>
		{/each}
	</ul>
{:else if categories.data.length === 0}
	<p class="muted">{text.empty}</p>
{:else}
	<ul class="rows">
		{#each categories.data as category, index (category._id)}
			<li>
				<Card dense>
					<div class="item" class:dim={!category.isActive}>
						{#if renaming?.id === category._id}
							<form
								class="add"
								onsubmit={(event) => {
									event.preventDefault();
									void saveName(category);
								}}
							>
								<span class="grow">
									<Field label={text.rename}>
										<input bind:value={renaming.name} maxlength={40} autocomplete="off" />
									</Field>
								</span>
								<Button type="submit" variant="primary" disabled={busyId === category._id}>
									{text.save}
								</Button>
								<Button onclick={() => (renaming = null)}>{text.cancel}</Button>
							</form>
						{:else}
							<div class="top">
								<div class="names">
									<b class="name">{category.name}</b>
									{#if !category.isActive}
										<span class="warn">{text.hidden}</span>
									{/if}
								</div>
								<a href="{resolve('/admin/products')}?category={category._id}" class="link">
									{text.viewProducts}
								</a>
							</div>
							<div class="buttons">
								<Button
									icon
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
								</Button>
								<Button
									icon
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
								</Button>
								<Button onclick={() => (renaming = { id: category._id, name: category.name })}>
									{text.rename}
								</Button>
								<Button
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
								</Button>
							</div>
						{/if}
					</div>
				</Card>
			</li>
		{/each}
	</ul>
{/if}

<style lang="postcss">
	@reference 'src/app.css';

	.title {
		@apply text-2xl font-extrabold;
	}
	.muted {
		@apply text-sm text-text-muted;
	}
	.problem {
		@apply text-sm font-semibold text-danger;
	}
	.add {
		@apply flex max-w-xl items-end gap-2;
	}
	.grow {
		@apply flex-1;
	}
	.rows {
		@apply grid max-w-3xl gap-2;
	}
	.item {
		@apply flex flex-col gap-2;
	}
	.dim {
		@apply opacity-70;
	}
	.top {
		@apply flex items-center justify-between gap-2;
	}
	.names {
		@apply flex min-w-0 flex-col;
	}
	.name {
		@apply truncate;
	}
	.warn {
		@apply text-xs font-semibold text-warning;
	}
	.link {
		@apply shrink-0 text-sm font-semibold text-primary;
	}
	.buttons {
		@apply flex flex-wrap gap-2;
	}
	.holder {
		@apply block h-12 w-full;
	}
</style>
