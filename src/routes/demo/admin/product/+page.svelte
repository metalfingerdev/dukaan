<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
</script>

<Frame
	title="Product edit"
	replaces="/admin/products/[id] and /admin/products/new"
	wide
	needs={[
		'A short form: name, category, unit, price, MRP, photo, active switch; staff type fast, so keep it one column of big fields',
		'Photo: pick a file or take one with the camera; shows a preview, resized before upload',
		'A separate stock panel: current stock, then Received / Damaged / Set count with a note, and the history under it',
		'Stock is never typed into the product form; it only changes through the panel',
		'Save and Cancel stay in view'
	]}
>
	<div class="layout">
		<div class="d-card d-stack">
			<h3 class="d-sub">Details</h3>
			<label class="d-field">Name <input class="d-input" value="Banana" /></label>
			<label class="d-field">Category <select class="d-input"><option>Fruits &amp; Vegetables</option></select></label>
			<div class="d-grid2">
				<label class="d-field">Unit <input class="d-input" value="6 pcs" /></label>
				<label class="d-field">Low-stock alert at <input class="d-input" value="5" /></label>
				<label class="d-field">Price (&#8377;) <input class="d-input" value="40" /></label>
				<label class="d-field">MRP (&#8377;) <input class="d-input" value="48" /></label>
			</div>
			<div class="d-row"><span class="d-img photo">photo</span><button type="button" class="d-btn">Choose photo</button></div>
			<label class="d-row"><input type="checkbox" checked /> Active (visible to customers)</label>
			<div class="d-row"><button type="button" class="d-btn d-btn-primary">Save</button><button type="button" class="d-btn">Cancel</button></div>
		</div>

		<div class="d-card d-stack">
			<h3 class="d-sub">Stock: 3 in shop</h3>
			<div class="d-row"><button type="button" class="d-btn d-btn-sm d-btn-primary">Received</button><button type="button" class="d-btn d-btn-sm">Damaged</button><button type="button" class="d-btn d-btn-sm">Set count</button></div>
			<label class="d-field">Quantity <input class="d-input" /></label>
			<label class="d-field">Note <input class="d-input" /></label>
			<button type="button" class="d-btn">Apply</button>
			<table class="d-table">
				<thead><tr><th>When</th><th>Change</th><th>Why</th></tr></thead>
				<tbody>
					<tr><td>Today 9:10</td><td>+24</td><td>Received</td></tr>
					<tr><td>Today 6:02</td><td>-2</td><td>Order #1042</td></tr>
				</tbody>
			</table>
		</div>
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.layout {
		@apply grid gap-4 lg:grid-cols-2;
	}
	.photo {
		@apply size-20;
	}
</style>
