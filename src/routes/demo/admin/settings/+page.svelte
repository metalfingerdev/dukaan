<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
</script>

<Frame
	title="Settings"
	replaces="/admin/settings"
	wide
	needs={[
		'Grouped sections the owner can scan: Store (name, phone), Hours, Fees, Delivery areas, Payments (UPI id)',
		'An "open now / closed" override for emergencies',
		'Each section saves on its own with a clear "Saved" confirmation',
		'Fees are typed in rupees and shown as rupees; the free-delivery threshold has a plain-language hint'
	]}
>
	<div class="grid">
		<div class="d-card d-stack">
			<h3 class="d-sub">Store</h3>
			<label class="d-field">Phone <input class="d-input" value="98XXXXXX00" /></label>
			<label class="d-field">UPI id <input class="d-input" value="store@upi" /></label>
			<label class="d-row"><input type="checkbox" checked /> Accepting orders</label>
			<button type="button" class="d-btn d-btn-primary">Save</button>
		</div>
		<div class="d-card d-stack">
			<h3 class="d-sub">Hours</h3>
			<div class="d-row"><input class="d-input time" value="9:00 am" /> to <input class="d-input time" value="9:30 pm" /></div>
			<label class="d-field">Delivery time shown (minutes) <input class="d-input" value="30" /></label>
			<button type="button" class="d-btn d-btn-primary">Save</button>
		</div>
		<div class="d-card d-stack">
			<h3 class="d-sub">Fees</h3>
			<label class="d-field">Delivery fee (&#8377;) <input class="d-input" value="20" /></label>
			<label class="d-field">Free delivery above (&#8377;) <input class="d-input" value="300" /></label>
			<label class="d-field">Small-cart fee (&#8377;) below (&#8377;) <input class="d-input" value="10 / 100" /></label>
			<button type="button" class="d-btn d-btn-primary">Save</button>
		</div>
		<div class="d-card d-stack">
			<h3 class="d-sub">Delivery areas</h3>
			<ul class="d-list">
				<li class="d-item"><span>Kothri Kalan town</span><button type="button" class="d-btn d-btn-sm">Remove</button></li>
				<li class="d-item"><span>College road</span><button type="button" class="d-btn d-btn-sm">Remove</button></li>
			</ul>
			<div class="d-row"><input class="d-input area" placeholder="Add an area" /><button type="button" class="d-btn">Add</button></div>
		</div>
	</div>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.grid {
		@apply grid gap-4 lg:grid-cols-2;
	}
	.time {
		@apply w-32;
	}
	.area {
		@apply flex-1;
	}
</style>
