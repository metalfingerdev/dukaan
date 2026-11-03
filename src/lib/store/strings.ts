/**
 * All store UI text lives here, so Hindi can be added by giving this object a second locale
 * without touching components. English only for now.
 */
export const strings = {
	store: {
		open: 'Open',
		closed: 'Closed',
		closedBanner: "We're closed right now. You can browse, but you can't check out until we open.",
		deliveryIn: (minutes: number) => `Delivery in ~${minutes} min`,
		notSetUp: 'The store is not set up yet.'
	},
	product: {
		outOfStock: 'Out of stock',
		onlyLeft: (count: number) => `Only ${count} left`,
		percentOff: (percent: number) => `${percent}% off`,
		add: 'Add',
		moreInCategory: 'More in this category',
		notFound: "We couldn't find that product.",
		maxPerOrder: (count: number) => `Up to ${count} per order`
	},
	home: {
		categories: 'Shop by category',
		featured: 'Popular right now',
		empty: 'No products yet. Check back soon.'
	},
	category: {
		notFound: "We couldn't find that category.",
		empty: 'Nothing here yet.',
		back: 'All categories'
	},
	search: {
		placeholder: 'Search for products',
		button: 'Search',
		prompt: 'Type at least 2 letters to search.',
		noResults: (query: string) => `No products match "${query}".`,
		resultsFor: (query: string) => `Results for "${query}"`
	},
	common: {
		backHome: 'Back to home',
		loading: 'Loading',
		error: 'Something went wrong. Please try again.'
	}
} as const;
