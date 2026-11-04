<script lang="ts">
	import Frame from '#lib/demo/Frame.svelte';
	import { partners } from '#lib/demo/data.js';
	import { formatPaise } from '#lib/store/format.js';
</script>

<Frame
	title="Delivery partners"
	replaces="/admin/delivery"
	wide
	needs={[
		'Add a partner by phone number (they sign in with that number); switch a partner on or off',
		'For each partner today: deliveries done and cash they hold',
		'"Settle cash" is a deliberate action: it shows the amount the admin is confirming, and refuses if it changed',
		'Partners with nothing to settle look calm; cash due stands out'
	]}
>
	<div class="d-card d-row">
		<input class="d-input phone" placeholder="Partner's phone number" inputmode="tel" />
		<button type="button" class="d-btn d-btn-primary">Add partner</button>
	</div>
	<table class="d-table">
		<thead><tr><th>Partner</th><th>Phone</th><th>Today</th><th>Cash to settle</th><th>Active</th><th></th></tr></thead>
		<tbody>
			{#each partners as partner (partner.phone)}
				<tr>
					<td><b>{partner.name}</b></td>
					<td>{partner.phone}</td>
					<td>{partner.deliveries} deliveries</td>
					<td>{#if partner.cashPaise > 0}<span class="d-pill d-pill-warn">{formatPaise(partner.cashPaise)}</span>{:else}&ndash;{/if}</td>
					<td><input type="checkbox" checked={partner.active} aria-label="Active" /></td>
					<td>{#if partner.cashPaise > 0}<button type="button" class="d-btn d-btn-sm d-btn-primary">Settle cash</button>{/if}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Frame>

<style lang="postcss">
	@reference 'src/app.css';

	.phone {
		@apply max-w-xs;
	}
</style>
