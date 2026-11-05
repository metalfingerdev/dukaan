<script lang="ts">
	// Add or edit one product. Shown by /admin/products/new and /admin/products/[id]; access is
	// checked by the admin layout (UX) and by every admin Convex function (security).
	import { resolve } from '$app/paths';
	import { ConvexError } from 'convex/values';
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import type { Id } from '#convex/_generated/dataModel.js';
	import type { ProductField } from '#convex/model/store/product.js';

	import { gotoApp } from '#lib/primitives/utils/navigation.js';
	import { paiseToInput, parseRupees } from '#lib/store/inputs.js';
	import { strings } from '#lib/store/strings.js';
	import ProductPhoto from './ProductPhoto.svelte';
	import { uploadProductImage } from './uploadImage.js';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';

	type Category = { _id: Id<'categories'>; name: string; isActive: boolean };
	type Product = {
		_id: Id<'products'>;
		categoryId: Id<'categories'>;
		name: string;
		unitLabel: string;
		pricePaise: number;
		mrpPaise: number;
		stock: number;
		maxPerOrder: number;
		isActive: boolean;
		isFeatured: boolean;
		imageUrl: string | null;
		lowStockAt?: number;
		gstRatePercent?: number;
		hsn?: string;
	};

	let { categories, product, initialCategoryId }: {
		categories: Category[];
		/** Unset when adding a new product */
		product?: Product;
		initialCategoryId?: Id<'categories'>;
	} = $props();

	const client = useConvexClient();
	const text = strings.admin.products.form;

	// Everything as the text in its input; converted only when saving. The form is filled once
	// from the props: later changes to the query don't overwrite typing.
	// svelte-ignore state_referenced_locally -- the initial value is wanted
	const form = $state({
		name: product?.name ?? '',
		unitLabel: product?.unitLabel ?? '',
		categoryId: product?.categoryId ?? initialCategoryId ?? '',
		pricePaise: product ? paiseToInput(product.pricePaise) : '',
		mrpPaise: product ? paiseToInput(product.mrpPaise) : '',
		stock: '0',
		lowStockAt: product?.lowStockAt !== undefined ? String(product.lowStockAt) : '',
		maxPerOrder: String(product?.maxPerOrder ?? 10),
		isActive: product?.isActive ?? true,
		isFeatured: product?.isFeatured ?? false,
		gstRatePercent: product?.gstRatePercent !== undefined ? String(product.gstRatePercent) : '',
		hsn: product?.hsn ?? ''
	});

	let photoFile = $state<File | null>(null);
	let errors = $state<Partial<Record<ProductField, string>>>({});
	let message = $state('');
	let saving = $state(false);
	let createdId = $state<Id<'products'> | null>(null);

	const wholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : null);

	/** The mutation's arguments, or the fields that can't be read */
	const parseForm = () => {
		const found: Partial<Record<ProductField, string>> = {};
		const fail = (field: Exclude<keyof typeof text.errors, never>) => {
			found[field as ProductField] = text.errors[field];
		};

		if (!form.name.trim()) fail('name');
		if (!form.unitLabel.trim()) fail('unitLabel');
		if (!form.categoryId) fail('categoryId');
		const pricePaise = parseRupees(form.pricePaise);
		if (pricePaise === null || pricePaise < 1) fail('pricePaise');
		const mrpPaise = parseRupees(form.mrpPaise);
		if (mrpPaise === null || (pricePaise !== null && mrpPaise < pricePaise)) fail('mrpPaise');
		const maxPerOrder = wholeNumber(form.maxPerOrder);
		if (maxPerOrder === null || maxPerOrder < 1 || maxPerOrder > 100) fail('maxPerOrder');

		let stock = 0;
		if (!product) {
			const parsed = wholeNumber(form.stock);
			if (parsed === null) fail('stock');
			else stock = parsed;
		}

		let lowStockAt: number | undefined;
		if (form.lowStockAt.trim()) {
			const parsed = wholeNumber(form.lowStockAt);
			if (parsed === null || parsed > 100) fail('lowStockAt');
			else lowStockAt = parsed;
		}
		let gstRatePercent: number | undefined;
		if (form.gstRatePercent.trim()) {
			const parsed = Number(form.gstRatePercent.trim());
			if (!Number.isFinite(parsed) || parsed < 0 || parsed > 28) fail('gstRatePercent');
			else gstRatePercent = parsed;
		}
		if (form.hsn.trim() && !/^\d{2,8}$/.test(form.hsn.trim())) fail('hsn');

		if (Object.keys(found).length > 0) return { errors: found };
		return {
			errors: found,
			values: {
				categoryId: form.categoryId as Id<'categories'>,
				name: form.name,
				unitLabel: form.unitLabel,
				pricePaise: pricePaise!,
				mrpPaise: mrpPaise!,
				maxPerOrder: maxPerOrder!,
				lowStockAt,
				isActive: form.isActive,
				isFeatured: form.isFeatured,
				gstRatePercent,
				hsn: form.hsn.trim() || undefined
			},
			stock
		};
	};

	const save = async (event: SubmitEvent) => {
		event.preventDefault();
		message = '';
		const parsed = parseForm();
		errors = parsed.errors;
		if (!parsed.values) {
			message = text.fixErrors;
			return;
		}
		saving = true;
		try {
			if (product) {
				await client.mutation(api.store.admin.products.updateProduct, {
					productId: product._id,
					...parsed.values
				});
				message = text.saved;
			} else {
				const productId = await client.mutation(api.store.admin.products.createProduct, {
					...parsed.values,
					stock: parsed.stock
				});
				// The product exists now, so a second press of Add must not create it again
				createdId = productId;
				if (photoFile) {
					try {
						const imageId = await uploadProductImage(client, photoFile);
						await client.mutation(api.store.admin.products.setProductImage, { productId, imageId });
					} catch {
						message = text.createdPhotoFailed;
						return;
					}
				}
				await gotoApp(resolve('/admin/products/[id]', { id: productId }));
			}
		} catch (error) {
			const data = error instanceof ConvexError ? (error.data as { code?: string; field?: string }) : null;
			if (data?.code === 'INVALID_PRODUCT' && data.field) {
				const field = data.field as ProductField;
				errors = { [field]: text.errors[field as keyof typeof text.errors] };
				message = text.fixErrors;
			} else {
				message = strings.common.error;
			}
		} finally {
			saving = false;
		}
	};
</script>

<form class="form" onsubmit={save} novalidate>
	<Card dense>
		<fieldset class="group" disabled={createdId !== null}>
			<Field label={text.name} hint={text.nameHint} error={errors.name} errorId="name-error">
				<input
					bind:value={form.name}
					maxlength={80}
					autocomplete="off"
					aria-invalid={errors.name ? 'true' : undefined}
					aria-describedby={errors.name ? 'name-error' : undefined}
				/>
			</Field>

			<div class="two">
				<Field label={text.unitLabel} hint={text.unitHint} error={errors.unitLabel} errorId="unitLabel-error">
					<input
						bind:value={form.unitLabel}
						maxlength={30}
						autocomplete="off"
						aria-invalid={errors.unitLabel ? 'true' : undefined}
						aria-describedby={errors.unitLabel ? 'unitLabel-error' : undefined}
					/>
				</Field>
				<Field label={text.category} error={errors.categoryId} errorId="categoryId-error">
					<select
						bind:value={form.categoryId}
						aria-invalid={errors.categoryId ? 'true' : undefined}
						aria-describedby={errors.categoryId ? 'categoryId-error' : undefined}
					>
						<option value="" disabled>{text.pickCategory}</option>
						{#each categories as category (category._id)}
							<option value={category._id}>
								{category.name}{category.isActive ? '' : ` (${strings.admin.products.hidden})`}
							</option>
						{/each}
					</select>
				</Field>
			</div>

			<div class="two">
				<Field label={text.price} error={errors.pricePaise} errorId="pricePaise-error">
					<input
						inputmode="decimal"
						autocomplete="off"
						bind:value={form.pricePaise}
						aria-invalid={errors.pricePaise ? 'true' : undefined}
						aria-describedby={errors.pricePaise ? 'pricePaise-error' : undefined}
					/>
				</Field>
				<Field label={text.mrp} hint={text.mrpHint} error={errors.mrpPaise} errorId="mrpPaise-error">
					<input
						inputmode="decimal"
						autocomplete="off"
						bind:value={form.mrpPaise}
						aria-invalid={errors.mrpPaise ? 'true' : undefined}
						aria-describedby={errors.mrpPaise ? 'mrpPaise-error' : undefined}
					/>
				</Field>
			</div>

			{#if product}
				<p class="stock">
					<b>{text.currentStock}:</b>
					{product.stock}
					<span class="hint block">{text.stockLocked}</span>
				</p>
			{:else}
				<Field label={text.openingStock} hint={text.openingStockHint} error={errors.stock} errorId="stock-error">
					<input
						inputmode="numeric"
						autocomplete="off"
						bind:value={form.stock}
						aria-invalid={errors.stock ? 'true' : undefined}
						aria-describedby={errors.stock ? 'stock-error' : undefined}
					/>
				</Field>
			{/if}

			<div class="two">
				<Field label={text.maxPerOrder} error={errors.maxPerOrder} errorId="maxPerOrder-error">
					<input
						inputmode="numeric"
						autocomplete="off"
						bind:value={form.maxPerOrder}
						aria-invalid={errors.maxPerOrder ? 'true' : undefined}
						aria-describedby={errors.maxPerOrder ? 'maxPerOrder-error' : undefined}
					/>
				</Field>
				<Field label={text.lowStockAt} hint={text.lowStockHint} error={errors.lowStockAt} errorId="lowStockAt-error">
					<input
						inputmode="numeric"
						autocomplete="off"
						bind:value={form.lowStockAt}
						aria-invalid={errors.lowStockAt ? 'true' : undefined}
						aria-describedby={errors.lowStockAt ? 'lowStockAt-error' : undefined}
					/>
				</Field>
			</div>

			<label class="check">
				<input type="checkbox" bind:checked={form.isActive} />
				<span>{text.isActive}</span>
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={form.isFeatured} />
				<span>{text.isFeatured}</span>
			</label>
		</fieldset>
	</Card>

	<Card dense>
		<fieldset class="group" disabled={createdId !== null}>
			<legend class="legend">{text.taxTitle}</legend>
			<p class="hint">{text.taxHint}</p>
			<div class="two">
				<Field label={text.gstRate} error={errors.gstRatePercent} errorId="gstRatePercent-error">
					<input
						inputmode="decimal"
						autocomplete="off"
						bind:value={form.gstRatePercent}
						aria-invalid={errors.gstRatePercent ? 'true' : undefined}
						aria-describedby={errors.gstRatePercent ? 'gstRatePercent-error' : undefined}
					/>
				</Field>
				<Field label={text.hsn} error={errors.hsn} errorId="hsn-error">
					<input
						inputmode="numeric"
						autocomplete="off"
						bind:value={form.hsn}
						aria-invalid={errors.hsn ? 'true' : undefined}
						aria-describedby={errors.hsn ? 'hsn-error' : undefined}
					/>
				</Field>
			</div>
		</fieldset>
	</Card>

	<Card dense>
		{#if product}
			<ProductPhoto productId={product._id} imageUrl={product.imageUrl} />
		{:else}
			<fieldset class="group" disabled={createdId !== null}>
				<legend class="legend">{text.photoTitle}</legend>
				<input
					class="file"
					type="file"
					accept="image/*"
					aria-label={text.choosePhoto}
					onchange={(event) => (photoFile = event.currentTarget.files?.[0] ?? null)}
				/>
				<span class="hint">{text.photoHint}</span>
			</fieldset>
		{/if}
	</Card>

	<div class="submit">
		{#if createdId}
			<Button href={resolve('/admin/products/[id]', { id: createdId })} variant="primary" large>
				{text.openProduct}
			</Button>
		{:else}
			<Button type="submit" variant="primary" large disabled={saving}>
				{#if product}
					{saving ? text.saving : text.save}
				{:else}
					{saving ? text.creating : text.create}
				{/if}
			</Button>
		{/if}
		{#if message}
			<p class="message" role="status">{message}</p>
		{/if}
	</div>
</form>

<style lang="postcss">
	@reference 'src/app.css';

	.form {
		@apply flex max-w-3xl flex-col gap-4;
	}
	.group {
		@apply flex flex-col gap-3;
	}
	.legend {
		@apply mb-2 font-extrabold;
	}
	.two {
		@apply grid gap-3 sm:grid-cols-2;
	}
	.stock {
		@apply text-sm;
	}
	.hint {
		@apply text-xs text-text-muted;
	}
	.block {
		@apply block;
	}
	.check {
		@apply flex min-h-11 items-center gap-3;
	}
	.check input {
		@apply size-5 text-primary;
	}
	.file {
		@apply min-h-11;
	}
	.submit {
		@apply flex flex-col items-start gap-2;
	}
	.message {
		@apply text-sm font-semibold;
	}
</style>
