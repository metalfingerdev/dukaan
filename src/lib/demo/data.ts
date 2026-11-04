/** Static sample data for the /demo screens. Money is integer paise, as everywhere else. */

export const categories = [
	{ slug: 'fruits-vegetables', name: 'Fruits & Vegetables' },
	{ slug: 'dairy-eggs', name: 'Dairy & Eggs' },
	{ slug: 'atta-rice-dal', name: 'Atta, Rice & Dal' },
	{ slug: 'snacks', name: 'Snacks & Biscuits' },
	{ slug: 'beverages', name: 'Beverages' },
	{ slug: 'instant-food', name: 'Instant Food & Noodles' },
	{ slug: 'personal-care', name: 'Personal Care' },
	{ slug: 'household', name: 'Household & Cleaning' }
];

export type DemoProduct = {
	id: string;
	name: string;
	unit: string;
	pricePaise: number;
	mrpPaise: number;
	stock: 'ok' | 'low' | 'out';
	stockLeft?: number;
};

export const products: DemoProduct[] = [
	{ id: 'onion', name: 'Onion', unit: '1 kg', pricePaise: 3800, mrpPaise: 4500, stock: 'ok' },
	{ id: 'banana', name: 'Banana', unit: '6 pcs', pricePaise: 4000, mrpPaise: 4800, stock: 'low', stockLeft: 3 },
	{ id: 'milk', name: 'Toned Milk', unit: '500 ml', pricePaise: 2900, mrpPaise: 3000, stock: 'ok' },
	{ id: 'eggs', name: 'Eggs', unit: '6 pcs', pricePaise: 4800, mrpPaise: 5400, stock: 'ok' },
	{ id: 'atta', name: 'Wheat Atta', unit: '5 kg', pricePaise: 23500, mrpPaise: 26000, stock: 'ok' },
	{ id: 'chips', name: 'Salted Chips', unit: '52 g', pricePaise: 2000, mrpPaise: 2000, stock: 'out' },
	{ id: 'juice', name: 'Mixed Fruit Juice', unit: '1 L', pricePaise: 11000, mrpPaise: 12000, stock: 'ok' },
	{ id: 'noodles', name: 'Instant Noodles', unit: '70 g', pricePaise: 1400, mrpPaise: 1500, stock: 'ok' }
];

export const cartLines = [
	{ product: products[0], quantity: 2 },
	{ product: products[2], quantity: 1 },
	{ product: products[4], quantity: 1 }
];

export const bill = {
	subtotalPaise: 3800 * 2 + 2900 + 23500,
	deliveryFeePaise: 2000,
	savingsPaise: 700 * 2 + 100 + 2500,
	totalPaise: 3800 * 2 + 2900 + 23500 + 2000
};

export const addresses = [
	{
		id: 'a1',
		label: 'Home',
		name: 'Asha Verma',
		phone: '98XXXXXX01',
		line: 'Near the post office, Ward 4, Kothri Kalan',
		landmark: 'Blue gate opposite the temple',
		pinned: true
	},
	{
		id: 'a2',
		label: 'Hostel',
		name: 'Asha Verma',
		phone: '98XXXXXX01',
		line: 'Girls hostel, college road, Kothri Kalan',
		landmark: 'Behind the canteen',
		pinned: false
	}
];

export const orderSteps = [
	{ label: 'Order placed', time: '6:02 pm', done: true, current: false },
	{ label: 'Accepted by the store', time: '6:03 pm', done: true, current: false },
	{ label: 'Packed', time: '6:11 pm', done: true, current: false },
	{ label: 'On the way', time: '6:14 pm', done: true, current: true },
	{ label: 'Delivered', time: '', done: false, current: false }
];

export const orders = [
	{ id: '1042', status: 'On the way', when: 'Today, 6:02 pm', items: 4, totalPaise: 37100 },
	{ id: '1038', status: 'Delivered', when: '2 Nov, 11:20 am', items: 7, totalPaise: 52600 },
	{ id: '1031', status: 'Cancelled', when: '30 Oct, 8:05 pm', items: 2, totalPaise: 6800 }
];

export type BoardOrder = {
	id: string;
	customer: string;
	phone: string;
	items: number;
	totalPaise: number;
	pay: string;
	age: string;
};

export const board: Record<string, BoardOrder[]> = {
	New: [
		{ id: '1043', customer: 'Ravi', phone: '97XXXXXX22', items: 5, totalPaise: 41200, pay: 'Cash', age: '1 min ago' },
		{ id: '1044', customer: 'Meena', phone: '96XXXXXX13', items: 2, totalPaise: 8800, pay: 'Paid online', age: 'just now' }
	],
	Accepted: [
		{ id: '1041', customer: 'Sonu', phone: '95XXXXXX70', items: 3, totalPaise: 15600, pay: 'UPI at door', age: '6 min ago' }
	],
	Packed: [
		{ id: '1040', customer: 'Kavya', phone: '94XXXXXX08', items: 6, totalPaise: 48100, pay: 'Cash', age: '12 min ago' }
	],
	'Out for delivery': [
		{ id: '1042', customer: 'Asha', phone: '98XXXXXX01', items: 4, totalPaise: 37100, pay: 'Cash', age: '19 min ago' }
	]
};

export const adminProducts = [
	{ id: 'onion', name: 'Onion', category: 'Fruits & Vegetables', pricePaise: 3800, stock: 42, active: true },
	{ id: 'banana', name: 'Banana', category: 'Fruits & Vegetables', pricePaise: 4000, stock: 3, active: true },
	{ id: 'chips', name: 'Salted Chips', category: 'Snacks & Biscuits', pricePaise: 2000, stock: 0, active: true },
	{ id: 'oldjuice', name: 'Mango Drink 600 ml', category: 'Beverages', pricePaise: 4500, stock: 12, active: false }
];

export const partners = [
	{ name: 'Deepak', phone: '90XXXXXX11', active: true, deliveries: 9, cashPaise: 128400 },
	{ name: 'Imran', phone: '90XXXXXX12', active: true, deliveries: 5, cashPaise: 0 },
	{ name: 'Pappu', phone: '90XXXXXX13', active: false, deliveries: 0, cashPaise: 0 }
];

export const payments = [
	{ id: 'pay_Q1', order: '1044', method: 'Online', amountPaise: 8800, status: 'Captured', refund: '' },
	{ id: 'pay_Q2', order: '1039', method: 'UPI at door', amountPaise: 19800, status: 'Captured', refund: '' },
	{ id: 'pay_Q3', order: '1036', method: 'Online', amountPaise: 12500, status: 'Captured', refund: 'Refund failed' }
];
