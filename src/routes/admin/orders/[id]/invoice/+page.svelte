<script lang="ts">
	// Access is checked by the admin layout (UX) and by `getInvoice` (security)
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '#convex/_generated/api.js';
	import InvoicePage from '#lib/store/ui/InvoicePage.svelte';

	const orderId = $derived(page.params.id ?? '');
	const invoice = useQuery(api.store.admin.orders.getInvoice, () => ({ orderId }));
</script>

<InvoicePage invoice={invoice.data} error={Boolean(invoice.error)} backHref={resolve('/admin/orders')} />
