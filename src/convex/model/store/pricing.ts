/**
 * Cart pricing, shared by the cart UI and `placeOrder` so what is shown is what is charged.
 * All amounts are integer paise.
 */
export type PriceLine = { pricePaise: number; mrpPaise: number; quantity: number };

export type Fees = {
	deliveryFeePaise: number;
	freeDeliveryAbovePaise: number;
	smallCartFeePaise: number;
	smallCartBelowPaise: number;
};

const assertWhole = (value: number, what: string) => {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${what} must be a non-negative whole number, got ${value}`);
	}
};

export function priceCart(lines: PriceLine[], fees: Fees) {
	let subtotalPaise = 0;
	let mrpTotalPaise = 0;
	for (const line of lines) {
		assertWhole(line.pricePaise, 'pricePaise');
		assertWhole(line.mrpPaise, 'mrpPaise');
		assertWhole(line.quantity, 'quantity');
		subtotalPaise += line.pricePaise * line.quantity;
		mrpTotalPaise += line.mrpPaise * line.quantity;
	}
	// An empty cart has nothing to deliver, so it owes no fees
	const hasItems = lines.some((line) => line.quantity > 0);
	const deliveryFeePaise =
		hasItems && subtotalPaise < fees.freeDeliveryAbovePaise ? fees.deliveryFeePaise : 0;
	const smallCartFeePaise =
		hasItems && subtotalPaise < fees.smallCartBelowPaise ? fees.smallCartFeePaise : 0;
	return {
		subtotalPaise,
		// Never negative, even if a product's MRP was entered below its price
		savingsPaise: Math.max(0, mrpTotalPaise - subtotalPaise),
		deliveryFeePaise,
		smallCartFeePaise,
		totalPaise: subtotalPaise + deliveryFeePaise + smallCartFeePaise
	};
}
