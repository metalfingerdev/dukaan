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
	checkout: {
		title: 'Checkout',
		address: 'Delivery address',
		addAddress: 'Add a new address',
		useSaved: 'Use a saved address',
		manageAddresses: 'Manage addresses',
		needAddress: 'Add a delivery address to continue.',
		delivery: 'Delivery time',
		asap: (minutes: number) => `As soon as possible (about ${minutes} min)`,
		slotGone: 'That time is no longer available. Please choose another.',
		payment: 'Payment',
		cod: 'Cash on delivery',
		upi: 'UPI on delivery',
		upiHint: 'Pay the delivery partner by UPI when your order arrives.',
		note: 'Note for the delivery partner (optional)',
		notePlaceholder: 'For example: call at the gate',
		placeOrder: (amount: string) => `Place order, ${amount}`,
		placing: 'Placing your order...',
		closed: "We're closed right now, so we can't take orders. Please come back when we open.",
		belowMinimum: (amount: string) => `Add items to reach the minimum order of ${amount}.`,
		areaGone: "We no longer deliver to this address's area. Please choose another address.",
		reviewCart: 'Review your cart',
		backToCart: 'Back to your cart',
		errors: {
			PRICE_CHANGED: (amount: string) =>
				`Prices changed while you were checking out. Your total is now ${amount}. Please check it and place the order again.`,
			CART_CHANGED: 'Some items in your cart changed. Please review them.',
			BELOW_MINIMUM: (amount: string) => `The minimum order is ${amount}.`,
			STORE_CLOSED: "We're closed right now, so we can't take orders.",
			STORE_NOT_SET_UP: 'The store is not set up yet. Please try again later.',
			OUT_OF_AREA: "We don't deliver to that address's area. Please choose another address.",
			ADDRESS_NOT_FOUND: 'That address is no longer available. Please choose another.',
			INVALID_SLOT: 'That delivery time is no longer available. Please choose another.',
			INVALID_NOTE: 'Your note is too long. Please shorten it.',
			EMPTY_CART: 'Your cart is empty.',
			TOO_MANY_OPEN_ORDERS: (max: number) =>
				`You already have ${max} orders in progress. Please wait for one to finish.`,
			RATE_LIMITED: "You've placed a lot of orders in a short time. Please try again later.",
			UNKNOWN: 'We could not place your order. Please try again.'
		},
		problems: {
			unavailable: 'no longer available',
			out_of_stock: (available: number) =>
				available > 0 ? `only ${available} available` : 'out of stock',
			over_limit: (available: number) => `up to ${available} per order`
		}
	},
	orders: {
		title: 'Your orders',
		empty: 'You have not placed any orders yet.',
		startShopping: 'Start shopping',
		loadMore: 'Show older orders',
		orderNumber: (number: number) => `Order #${number}`,
		placedBanner: 'Your order is placed. We will update this page as it moves along.',
		notFound: "We couldn't find that order.",
		backToOrders: 'Back to your orders',
		timeline: 'Progress',
		items: 'Items',
		bill: 'Bill',
		deliveringTo: 'Delivering to',
		deliveryTime: 'Delivery time',
		asap: 'As soon as possible',
		payment: 'Payment',
		note: 'Your note',
		cancel: 'Cancel order',
		confirmCancel: 'Cancel this order?',
		cancelFailed: "We couldn't cancel this order. It may already be on its way.",
		cancelledNote: 'This order was cancelled.',
		cantCancel: 'This order is already being prepared. To cancel it, please call the store.',
		callStore: 'Call the store',
		contactStore: 'Please contact the store.',
		codeTitle: 'Your delivery code',
		codeOnTheWay: 'Tell this to your delivery partner when you receive your order.',
		codeKeep: 'Keep this code. You will need it when your order arrives.',
		paymentMethod: { cod: 'Cash on delivery', upi_on_delivery: 'UPI on delivery' },
		paymentStatus: { pending: 'To pay on delivery', paid: 'Paid', refunded: 'Refunded' },
		status: {
			placed: 'Order placed',
			accepted: 'Accepted by the store',
			packed: 'Packed',
			out_for_delivery: 'On the way',
			delivered: 'Delivered',
			delivery_failed: 'Delivery attempt failed',
			cancelled: 'Cancelled'
		}
	},
	common: {
		backHome: 'Back to home',
		loading: 'Loading',
		error: 'Something went wrong. Please try again.'
	}
} as const;
