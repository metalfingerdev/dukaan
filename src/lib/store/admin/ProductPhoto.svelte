<script lang="ts">
	// The photo of an existing product. Uploads and removes take effect at once; they are not part
	// of the form's Save button.
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { strings } from '#lib/store/strings.js';
	import { uploadProductImage } from './uploadImage.js';

	let { productId, imageUrl }: { productId: Id<'products'>; imageUrl: string | null } = $props();

	const client = useConvexClient();
	const text = strings.admin.products.form;

	let busy = $state(false);
	let message = $state('');

	// The query behind the page delivers the new URL, so show what was just saved right away
	let shown = $state<string | null | undefined>(undefined);
	const current = $derived(shown === undefined ? imageUrl : shown);

	const change = async (event: Event & { currentTarget: HTMLInputElement }) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		busy = true;
		message = text.uploading;
		try {
			const imageId = await uploadProductImage(client, file);
			await client.mutation(api.store.admin.products.setProductImage, { productId, imageId });
			shown = undefined;
			message = text.photoSaved;
		} catch {
			message = text.photoFailed;
		} finally {
			busy = false;
			input.value = '';
		}
	};

	const remove = async () => {
		busy = true;
		message = '';
		try {
			await client.mutation(api.store.admin.products.setProductImage, { productId, imageId: null });
			shown = null;
			message = text.photoRemoved;
		} catch {
			message = strings.common.error;
		} finally {
			busy = false;
		}
	};
</script>

<fieldset class="flex flex-col gap-3" disabled={busy}>
	<legend class="mb-2 font-semibold">{text.photoTitle}</legend>
	<div class="flex items-center gap-4">
		<div
			class="bg-surface-100-900 flex size-24 shrink-0 items-center justify-center overflow-hidden rounded text-xs"
		>
			{#if current}
				<img src={current} alt="" class="size-full object-cover" width="96" height="96" />
			{:else}
				<span class="text-surface-600-400">{strings.admin.products.noPhoto}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-2">
			<label class="btn preset-tonal min-h-11 cursor-pointer">
				{current ? text.changePhoto : text.choosePhoto}
				<input type="file" accept="image/*" class="sr-only" onchange={change} />
			</label>
			{#if current}
				<button type="button" class="btn preset-tonal min-h-11" onclick={remove}>
					{text.removePhoto}
				</button>
			{/if}
		</div>
	</div>
	<span class="text-surface-600-400 text-xs">{text.photoHint}</span>
	{#if message}
		<p class="text-sm" role="status">{message}</p>
	{/if}
</fieldset>
