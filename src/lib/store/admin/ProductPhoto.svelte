<script lang="ts">
	// The photo of an existing product. Uploads and removes take effect at once; they are not part
	// of the form's Save button.
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';

	import { strings } from '#lib/store/strings.js';
	import { uploadProductImage } from './uploadImage.js';
	import Button from '#lib/ui/Button.svelte';

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

<fieldset class="photo" disabled={busy}>
	<legend class="legend">{text.photoTitle}</legend>
	<div class="row">
		<div class="preview">
			{#if current}
				<img src={current} alt="" width="96" height="96" />
			{:else}
				<span class="none">{strings.admin.products.noPhoto}</span>
			{/if}
		</div>
		<div class="buttons">
			<!-- A file input in a label: the label is the button, the input stays for the tests and
				screen readers -->
			<label class="pick">
				{current ? text.changePhoto : text.choosePhoto}
				<input type="file" accept="image/*" class="sr-only" onchange={change} />
			</label>
			{#if current}
				<Button onclick={remove}>{text.removePhoto}</Button>
			{/if}
		</div>
	</div>
	<span class="hint">{text.photoHint}</span>
	{#if message}
		<p class="message" role="status">{message}</p>
	{/if}
</fieldset>

<style lang="postcss">
	@reference 'src/app.css';

	.photo {
		@apply flex flex-col gap-3;
	}
	.legend {
		@apply mb-2 font-extrabold;
	}
	.row {
		@apply flex items-center gap-4;
	}
	.preview {
		--fill: var(--color-background);
		@apply edge-flat flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background text-xs;
	}
	.preview img {
		@apply size-full object-cover;
	}
	.none {
		@apply text-text-muted;
	}
	.buttons {
		@apply flex flex-col gap-2;
	}
	.pick {
		--fill: var(--color-foreground);
		@apply edge edge-press inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-foreground px-4 font-bold;
	}
	.hint {
		@apply text-xs text-text-muted;
	}
	.message {
		@apply text-sm font-semibold;
	}
</style>
