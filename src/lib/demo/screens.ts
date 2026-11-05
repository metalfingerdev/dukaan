/** Every demo screen, grouped, for the index and the jump menu. `href` is a path under /demo. */
export const screenGroups = [
	{
		group: 'Customer',
		screens: [
			['/demo/home', 'Home', 'Open/closed, search, category grid, popular shelf, cart bar'],
			['/demo/category', 'Category', 'Product grid with sort and in-stock filter'],
			['/demo/product', 'Product', 'Big photo, price, add to cart, more in category'],
			['/demo/search', 'Search', 'Results, and the no-results state'],
			['/demo/cart', 'Cart', 'Lines, bill, closed banner, empty state'],
			['/demo/checkout', 'Checkout', 'Address, slot, payment, summary, place order'],
			['/demo/orders', 'My orders', 'List, newest first'],
			['/demo/order', 'Order tracking', 'Status timeline, delivery code, partner, items'],
			['/demo/invoice', 'Invoice', 'Printable tax invoice'],
			['/demo/account', 'Addresses', 'Saved addresses and the add form'],
			['/demo/signin', 'Sign in', 'Phone OTP first']
		]
	},
	{
		group: 'Parts',
		screens: [['/demo/kit', 'Kit', 'Buttons, inputs, pills, states, toast, sheet, skeleton']]
	},
	{
		group: 'Admin (desktop and tablet)',
		screens: [
			['/demo/admin/board', 'Order board', 'Columns by status, accept, reject, pack, assign'],
			['/demo/admin/products', 'Products', 'Table with stock and active toggle'],
			['/demo/admin/product', 'Product edit', 'Form, photo, stock panel'],
			['/demo/admin/partners', 'Delivery partners', 'Add by phone, cash to settle'],
			['/demo/admin/payments', 'Payments', 'Razorpay payments and refunds'],
			['/demo/admin/settings', 'Settings', 'Hours, fees, areas, phone, UPI id']
		]
	},
	{
		group: 'Delivery partner (phone)',
		screens: [
			['/demo/rider/home', 'My deliveries', 'To pick up, on the way, tally, cash to hand over'],
			['/demo/rider/order', 'Delivery', 'Collect line, call, maps, items, delivered code']
		]
	}
] as const;
