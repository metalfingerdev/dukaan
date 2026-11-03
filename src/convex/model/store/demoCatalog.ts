/**
 * Made-up catalogue for development: generic names, no real brands, no images. The seed loads it
 * (store/seed.ts); the real catalogue is entered through the admin screens. Prices are integer
 * paise, written through `rs()` so the data stays readable.
 */
const rs = (rupees: number) => Math.round(rupees * 100);

export type DemoCategory = { slug: string; name: string };

export type DemoProduct = {
	slug: string;
	categorySlug: string;
	name: string;
	unitLabel: string;
	pricePaise: number;
	mrpPaise: number;
	stock: number;
	maxPerOrder: number;
	lowStockAt?: number;
	isFeatured?: boolean;
};

// The student + local kirana set; sortOrder follows this order
export const DEMO_CATEGORIES: DemoCategory[] = [
	{ slug: 'fruits-vegetables', name: 'Fruits & Vegetables' },
	{ slug: 'dairy-eggs', name: 'Dairy & Eggs' },
	{ slug: 'atta-rice-dal', name: 'Atta, Rice & Dal' },
	{ slug: 'snacks-biscuits', name: 'Snacks & Biscuits' },
	{ slug: 'beverages', name: 'Beverages' },
	{ slug: 'instant-food-noodles', name: 'Instant Food & Noodles' },
	{ slug: 'personal-care', name: 'Personal Care' },
	{ slug: 'household-cleaning', name: 'Household & Cleaning' },
	{ slug: 'stationery', name: 'Stationery' }
];

const p = (
	categorySlug: string,
	slug: string,
	name: string,
	unitLabel: string,
	price: number,
	mrp: number,
	stock: number,
	extra: Partial<Pick<DemoProduct, 'maxPerOrder' | 'lowStockAt' | 'isFeatured'>> = {}
): DemoProduct => ({
	slug,
	categorySlug,
	name,
	unitLabel,
	pricePaise: rs(price),
	mrpPaise: rs(mrp),
	stock,
	maxPerOrder: extra.maxPerOrder ?? 5,
	...(extra.lowStockAt !== undefined ? { lowStockAt: extra.lowStockAt } : {}),
	...(extra.isFeatured ? { isFeatured: true } : {})
});

export const DEMO_PRODUCTS: DemoProduct[] = [
	p('fruits-vegetables', 'tomato-500g', 'Tomato', '500 g', 25, 30, 40),
	p('fruits-vegetables', 'onion-1kg', 'Onion', '1 kg', 38, 45, 60, { isFeatured: true }),
	p('fruits-vegetables', 'potato-1kg', 'Potato', '1 kg', 32, 40, 50),
	p('fruits-vegetables', 'banana-6pc', 'Banana', '6 pcs', 40, 48, 30, { isFeatured: true }),
	// Low stock on purpose: shows the "Only N left" state
	p('fruits-vegetables', 'apple-4pc', 'Apple', '4 pcs', 120, 140, 3, { lowStockAt: 5 }),

	p('dairy-eggs', 'toned-milk-500ml', 'Toned Milk', '500 ml', 29, 30, 80, { isFeatured: true }),
	p('dairy-eggs', 'curd-400g', 'Curd', '400 g', 35, 40, 25),
	p('dairy-eggs', 'paneer-200g', 'Paneer', '200 g', 85, 95, 12),
	p('dairy-eggs', 'eggs-6pc', 'Eggs', '6 pcs', 48, 54, 40, { isFeatured: true }),
	// Out of stock on purpose: shows the "Out of stock" state
	p('dairy-eggs', 'butter-100g', 'Butter', '100 g', 58, 60, 0),

	p('atta-rice-dal', 'wheat-atta-5kg', 'Wheat Atta', '5 kg', 235, 260, 20, { isFeatured: true }),
	p('atta-rice-dal', 'basmati-rice-1kg', 'Basmati Rice', '1 kg', 95, 110, 30),
	p('atta-rice-dal', 'toor-dal-1kg', 'Toor Dal', '1 kg', 160, 175, 25),
	p('atta-rice-dal', 'sugar-1kg', 'Sugar', '1 kg', 48, 52, 40),
	p('atta-rice-dal', 'salt-1kg', 'Salt', '1 kg', 25, 28, 50),

	p('snacks-biscuits', 'glucose-biscuits-200g', 'Glucose Biscuits', '200 g', 20, 20, 60),
	p('snacks-biscuits', 'salted-chips-52g', 'Salted Chips', '52 g', 20, 20, 70, { isFeatured: true }),
	p('snacks-biscuits', 'bhujia-200g', 'Bhujia', '200 g', 55, 60, 30),
	p('snacks-biscuits', 'chocolate-bar-40g', 'Chocolate Bar', '40 g', 40, 40, 45),

	p('beverages', 'tea-powder-250g', 'Tea Powder', '250 g', 120, 130, 25),
	p('beverages', 'instant-coffee-50g', 'Instant Coffee', '50 g', 150, 165, 15),
	p('beverages', 'cola-750ml', 'Cola', '750 ml', 40, 45, 50),
	p('beverages', 'mixed-fruit-juice-1l', 'Mixed Fruit Juice', '1 L', 110, 120, 20, {
		isFeatured: true
	}),
	p('beverages', 'packaged-water-1l', 'Packaged Water', '1 L', 20, 20, 100, { maxPerOrder: 12 }),

	p('instant-food-noodles', 'instant-noodles-70g', 'Instant Noodles', '70 g', 14, 15, 100, {
		maxPerOrder: 10,
		isFeatured: true
	}),
	p('instant-food-noodles', 'pasta-200g', 'Pasta', '200 g', 45, 50, 20),
	p('instant-food-noodles', 'cup-noodles-70g', 'Cup Noodles', '70 g', 40, 45, 35),

	p('personal-care', 'bathing-soap-100g', 'Bathing Soap', '100 g', 38, 40, 50),
	p('personal-care', 'shampoo-180ml', 'Shampoo', '180 ml', 120, 140, 20),
	p('personal-care', 'toothpaste-100g', 'Toothpaste', '100 g', 65, 70, 35),

	p('household-cleaning', 'detergent-powder-1kg', 'Detergent Powder', '1 kg', 110, 125, 20),
	p('household-cleaning', 'dishwash-gel-500ml', 'Dishwash Gel', '500 ml', 99, 110, 15),
	p('household-cleaning', 'tissue-paper-2pc', 'Tissue Paper', '2 rolls', 50, 55, 25),

	p('stationery', 'notebook-172pg', 'Notebook', '172 pages', 50, 55, 40, { isFeatured: true }),
	p('stationery', 'ball-pen-5pc', 'Ball Pen', '5 pcs', 50, 50, 60),
	p('stationery', 'highlighter-1pc', 'Highlighter', '1 pc', 30, 35, 20)
];
