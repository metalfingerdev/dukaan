/**
 * Turning what the admin types into stored values and back. Money is entered in rupees and stored
 * as integer paise; times are entered as "HH:MM" and stored as minutes after midnight IST.
 */

/**
 * "299", "299.5", "1,299.50" or "₹ 20" as paise, or `null` for anything else (more than two
 * decimals, a minus sign, letters, nothing). Works on the digits as text, so no float rounding.
 */
export function parseRupees(text: string): number | null {
	const clean = text.trim().replace(/^₹/, '').replace(/[\s,]/g, '');
	const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
	if (!match) return null;
	const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
	return Number.isSafeInteger(paise) ? paise : null;
}

/** Paise as an input value: `29900` is "299", `29950` is "299.50" */
export const paiseToInput = (paise: number) =>
	paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);

/** `540` is "09:00", the value an `<input type="time">` takes */
export const minuteToTime = (minute: number) =>
	`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** "09:00" is `540`; `null` when the input is empty or malformed */
export function timeToMinute(value: string): number | null {
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}
