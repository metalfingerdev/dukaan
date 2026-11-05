<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { adminProducts } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Products"
	replaces="/admin/products (and categories, import)"
	wide
	needs={[
		'A dense, scannable table: photo, name, category, price, stock, active; search and category filter on top',
		'Low and zero stock stand out in colour so the shelf check is quick',
		'Quick actions: edit, adjust stock, hide (inactive); buttons for New product, Import CSV, Export CSV',
		'Works on a tablet; on a phone the table becomes a list of cards'
	]}
>
	<div class="d-between">
		<div class="d-row"><input class="d-input search" placeholder="Search products" /><select class="d-input search"><option>All categories</option></select></div>
		<div class="d-row"><a href="/demo/admin/product" class="d-btn d-btn-primary">+ New product</a><button type="button" class="d-btn">Import CSV</button><button type="button" class="d-btn">Export</button></div>
	</div>
	<table class="d-table">
		<thead><tr><th>Photo</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
		<tbody>
			{#each adminProducts as product (product.id)}
				<tr>
					<td><span class="d-img thumb">img</span></td>
					<td><b>{product.name}</b></td>
					<td>{product.category}</td>
					<td>{formatPaise(product.pricePaise)}</td>
					<td>
						<span class="d-pill" class:d-pill-bad={product.stock === 0} class:d-pill-warn={product.stock > 0 && product.stock < 5}>{product.stock}</span>
					</td>
					<td>{product.active ? 'Active' : 'Hidden'}</td>
					<td><a href="/demo/admin/product" class="d-btn d-btn-sm">Edit</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.thumb {
		@apply size-10;
	}
	.search {
		@apply w-56;
	}
</style>
