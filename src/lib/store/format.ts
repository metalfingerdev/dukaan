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

// Store time is India time whatever the visitor's phone says
const timeFormatter = new Intl.DateTimeFormat('en-IN', {
	timeZone: 'Asia/Kolkata',
	hour: 'numeric',
	minute: '2-digit'
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
	timeZone: 'Asia/Kolkata',
	day: 'numeric',
	month: 'short',
	hour: 'numeric',
	minute: '2-digit'
});

/** "11:00 am", in IST */
export const formatTime = (ms: number) => timeFormatter.format(ms);

/** "3 Nov, 11:00 am", in IST */
export const formatDateTime = (ms: number) => dateTimeFormatter.format(ms);

/** Minutes after midnight IST as "9:00 am" (opening hours) */
export const formatMinuteOfDay = (minute: number) =>
	formatTime(Date.UTC(2026, 0, 1, 0, minute) - 5.5 * 60 * 60 * 1000);

/** A delivery slot as a range, "11:00 am to 12:00 pm", given its start and length in minutes */
export const formatSlot = (startMs: number, slotMinutes: number) =>
	`${formatTime(startMs)} to ${formatTime(startMs + slotMinutes * 60 * 1000)}`;

/** "% off" for a product whose MRP is above its price, or `null` when there is no discount */
export const percentOff = (pricePaise: number, mrpPaise: number) =>
	mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : null;
