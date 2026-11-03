/**
 * All store UI text lives here, so Hindi can be added by giving this object a second locale
 * without touching components. English only for now.
 */
export const strings = {
	store: {
		open: 'Open',
		closed: 'Closed',
		closedBanner: "We're closed right now. You can browse, but you can't check out until we open.",
		deliveryIn: (minutes: number) => `Delivery in ~${minutes} min`
	},
	product: {
		outOfStock: 'Out of stock',
		onlyLeft: (count: number) => `Only ${count} left`,
		add: 'Add'
	}
} as const;
