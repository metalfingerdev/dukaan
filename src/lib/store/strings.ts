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
	cart: {
		title: 'Your cart',
		empty: 'Your cart is empty.',
		keepShopping: 'Keep shopping',
		viewCart: 'View cart',
		items: (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`,
		removeOne: 'Remove one',
		addOne: 'Add one',
		remove: 'Remove',
		maxReached: (count: number) => `Max ${count} for this item`,
		onlyAvailable: (count: number) => `Only ${count} available`,
		unavailable: 'No longer available',
		itemTotal: 'Item total',
		deliveryFee: 'Delivery fee',
		handlingFee: 'Handling fee',
		free: 'Free',
		youSave: 'You save',
		total: 'Total',
		addForFreeDelivery: (amount: string) => `Add ${amount} more for free delivery`,
		minimumOrder: (amount: string) => `Minimum order ${amount}`,
		checkout: 'Checkout',
		checkoutSoon: 'Checkout is coming soon',
		lineTotal: (amount: string) => `${amount}`
	},
	address: {
		title: 'Your addresses',
		empty: 'No saved addresses yet.',
		add: 'Add an address',
		edit: 'Edit',
		delete: 'Delete',
		confirmDelete: 'Delete this address?',
		makeDefault: 'Make default',
		isDefault: 'Default',
		save: 'Save address',
		cancel: 'Cancel',
		label: 'Name this address',
		labelHint: 'Home, Hostel, Shop',
		kind: 'Type',
		kinds: { house: 'House', hostel: 'Hostel / PG', shop: 'Shop' },
		line1: {
			house: 'House or flat number and street',
			hostel: 'Hostel or PG name, block and room',
			shop: 'Shop name and address'
		},
		area: 'Area',
		areaPlaceholder: 'Choose your area',
		landmark: 'Landmark (optional)',
		contactName: 'Who will receive the order?',
		contactPhone: 'Phone number for the delivery partner',
		useLocation: 'Use my current location',
		locating: 'Finding you...',
		locationSaved: 'Location saved. The delivery partner gets exact directions.',
		removeLocation: 'Remove location',
		locationDenied: "We couldn't get your location. You can still save the address without it.",
		makeDefaultCheckbox: 'Use this as my default address',
		errors: {
			OUT_OF_AREA: "We don't deliver to that area yet.",
			TOO_MANY_ADDRESSES: 'You can save up to 10 addresses. Delete one first.',
			STORE_NOT_SET_UP: 'The store is not set up yet. Please try again later.',
			ADDRESS_NOT_FOUND: 'That address no longer exists.',
			label: 'Give this address a short name.',
			line1: 'Please fill in the address.',
			contactName: 'Please enter a name.',
			contactPhone: 'Enter a valid 10-digit Indian mobile number.',
			location: "That location doesn't look right. Try again or skip it."
		}
	},
	common: {
		backHome: 'Back to home',
		loading: 'Loading',
		error: 'Something went wrong. Please try again.'
	}
} as const;
