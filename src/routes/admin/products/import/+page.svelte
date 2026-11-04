<script lang="ts">
	// Access is checked by ../../+layout.svelte (UX) and by every admin Convex function (security)
	import { resolve } from '$app/paths';
	import { ConvexError } from 'convex/values';
	import { useConvexClient } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import {
		IMPORT_COLUMNS,
		MAX_IMPORT_ROWS,
		type ImportColumn,
		type StockMode
	} from '#convex/model/store/productImport.js';

	import { parseCsv, toCsv } from '#lib/store/csv.js';
	import { strings } from '#lib/store/strings.js';

	const client = useConvexClient();
	const text = strings.admin.import;

	type Preview = Awaited<ReturnType<typeof client.query<typeof api.store.admin.import.previewImport>>>;

	let rows = $state<Record<string, string>[] | null>(null);
	let mode = $state<StockMode>('keep');
	let preview = $state<Preview | null>(null);
	let message = $state('');
	let busy = $state(false);
	let exportNote = $state('');
	// Only the newest preview request may fill the screen
	let requestId = 0;

	const errorCount = $derived(preview?.rows.filter((row) => row.kind === 'error').length ?? 0);
	const createdCount = $derived(preview?.rows.filter((row) => row.kind === 'new').length ?? 0);
	const updatedCount = $derived(preview?.rows.filter((row) => row.kind === 'update').length ?? 0);

	const runPreview = async () => {
		if (!rows) return;
		const mine = ++requestId;
		busy = true;
		try {
			const result = await client.query(api.store.admin.import.previewImport, { rows, mode });
			if (mine === requestId) preview = result;
		} catch {
			if (mine === requestId) message = strings.common.error;
		} finally {
			if (mine === requestId) busy = false;
		}
	};

	const chooseFile = async (event: Event & { currentTarget: HTMLInputElement }) => {
		const file = event.currentTarget.files?.[0];
		rows = null;
		preview = null;
		message = '';
		if (!file) return;
		try {
			const [header, ...data] = parseCsv(await file.text());
			const columns = header?.map((name) => name.trim().toLowerCase().replace(/\s+/g, '_')) ?? [];
			if (!columns.includes('name') && !columns.includes('slug')) {
				message = text.noColumns;
				return;
			}
			if (data.length > MAX_IMPORT_ROWS) {
				message = text.tooMany(MAX_IMPORT_ROWS);
				return;
			}
			const known = new Set<string>(IMPORT_COLUMNS);
			rows = data.map((cells) => {
				const row: Record<string, string> = {};
				columns.forEach((column, i) => {
					if (known.has(column as ImportColumn) && cells[i] !== undefined) row[column] = cells[i];
				});
				return row;
			});
		} catch {
			message = text.unreadable;
			return;
		}
		await runPreview();
	};

	const changeMode = (value: StockMode) => {
		mode = value;
		void runPreview();
	};

	const apply = async () => {
		if (!rows || !preview) return;
		busy = true;
		message = '';
		try {
			const result = await client.mutation(api.store.admin.import.applyImport, {
				rows,
				mode,
				seen: preview.seen
			});
			message = text.done(result.created, result.updated);
			rows = null;
			preview = null;
		} catch (error) {
			const code = error instanceof ConvexError ? (error.data as { code?: string }).code : undefined;
			message =
				code === 'STOCK_CHANGED'
					? text.stockChanged
					: code === 'IMPORT_HAS_ERRORS'
						? text.applyFailed
						: strings.common.error;
			if (code === 'STOCK_CHANGED' || code === 'IMPORT_HAS_ERRORS') await runPreview();
		} finally {
			busy = false;
		}
	};

	const download = async () => {
		exportNote = '';
		const data = await client.query(api.store.admin.import.exportProducts, {});
		const csv = toCsv([data.columns, ...data.rows.map((row) => data.columns.map((c) => row[c] ?? ''))]);
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = 'products.csv';
		link.click();
		URL.revokeObjectURL(url);
		if (data.truncated) exportNote = text.exportTruncated(MAX_IMPORT_ROWS);
	};

	const problemText = (problem: { field: string; reason: keyof typeof text.problems }) =>
		text.problems[problem.reason](problem.field);
</script>

<svelte:head>
	<title>{text.title} | {strings.admin.title}</title>
</svelte:head>

<a href={resolve('/admin/products')} class="text-primary-600-400 text-sm">&larr; {text.back}</a>
<h1 class="h3">{text.title}</h1>

<section class="flex flex-col gap-2">
	<h2 class="h5">{text.exportTitle}</h2>
	<p class="text-surface-600-400 text-sm">{text.exportHint}</p>
	<div>
		<button type="button" class="btn preset-tonal min-h-11" onclick={download}>{text.exportButton}</button>
	</div>
	{#if exportNote}<p class="text-sm" role="status">{exportNote}</p>{/if}
</section>

<section class="flex flex-col gap-3">
	<h2 class="h5">{text.importTitle}</h2>
	<p class="text-surface-600-400 text-sm">{text.importHint}</p>
	<p class="text-surface-600-400 text-xs">{text.columnsNote}</p>
	<input class="input" type="file" accept=".csv,text/csv" aria-label={text.chooseFile} onchange={chooseFile} />

	{#if rows}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-1 font-semibold">{text.modeTitle}</legend>
			{#each ['keep', 'add', 'set'] as const as option (option)}
				<label class="flex min-h-11 items-start gap-3">
					<input
						class="radio mt-1"
						type="radio"
						name="stock-mode"
						checked={mode === option}
						onchange={() => changeMode(option)}
						disabled={busy}
					/>
					<span>
						{text.modes[option].label}
						<span class="text-surface-600-400 block text-xs">{text.modes[option].hint}</span>
					</span>
				</label>
			{/each}
		</fieldset>
	{/if}

	{#if busy && !preview}<p class="text-sm" aria-busy="true">{text.previewing}</p>{/if}

	{#if preview}
		<p class="font-semibold" role="status">{text.summary(createdCount, updatedCount, errorCount)}</p>
		{#if preview.newCategories.length > 0}
			<p class="text-sm">{text.newCategories(preview.newCategories.join(', '))}</p>
		{/if}
		<ul class="flex max-h-96 flex-col gap-1 overflow-y-auto text-sm">
			{#each preview.rows as row (row.row)}
				<li
					class="card flex flex-wrap justify-between gap-x-3 p-2 {row.kind === 'error'
						? 'preset-tonal-error'
						: 'preset-outlined-surface-300-700'}"
				>
					<span class="min-w-0 truncate">
						<span class="text-surface-600-400">{text.row(row.row)}</span>
						{row.name}
					</span>
					<span>
						{#if row.problem}
							{problemText(row.problem)}
						{:else if row.kind === 'update' && row.stockFrom !== row.stockTo}
							{text.kind.update}: {text.stockChange(row.stockFrom ?? 0, row.stockTo ?? 0)}
						{:else if row.kind === 'new'}
							{text.kind.new}{row.stockTo ? `: ${text.openingStock(row.stockTo)}` : ''}
						{:else}
							{text.kind[row.kind]}
						{/if}
					</span>
				</li>
			{/each}
		</ul>
		{#if errorCount > 0}
			<p class="text-sm">{text.fixFirst}</p>
		{/if}
		<button
			type="button"
			class="btn preset-filled-primary-500 min-h-12"
			disabled={busy || errorCount > 0 || preview.rows.length === 0}
			onclick={apply}
		>
			{busy ? text.applying : text.apply}
		</button>
	{/if}

	{#if message}<p class="text-sm" role="status">{message}</p>{/if}
</section>
