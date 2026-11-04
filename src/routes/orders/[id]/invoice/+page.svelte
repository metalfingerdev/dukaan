<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import InvoicePage from '#lib/store/ui/InvoicePage.svelte';
	import { useRequireSignIn } from '#lib/store/requireSignIn.svelte.js';

	const auth = useRequireSignIn();
	const orderId = $derived(page.params.id ?? '');
	// `null` for an order that isn't delivered yet, isn't theirs, or doesn't exist
	const invoice = useQuery(api.store.orders.getInvoice, () => (auth.isAuthenticated ? { orderId } : 'skip'));
</script>

<InvoicePage
	invoice={invoice.data}
	error={Boolean(invoice.error)}
	backHref={resolve('/orders/[id]', { id: orderId })}
/>
