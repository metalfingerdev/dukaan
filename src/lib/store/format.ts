/**
 * Display formatting for the store. Money is integer paise everywhere else; convert only here,
 * at the edge.
 */
const rupeeFormatter = (fractionDigits: number) =>
	new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: 2
	});

const wholeRupees = rupeeFormatter(0);
const withPaise = rupeeFormatter(2);

/** `29900` becomes "₹299", `29950` becomes "₹299.50" */
export const formatPaise = (paise: number) =>
	(paise % 100 === 0 ? wholeRupees : withPaise).format(paise / 100);

/** "% off" for a product whose MRP is above its price, or `null` when there is no discount */
export const percentOff = (pricePaise: number, mrpPaise: number) =>
	mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : null;
