/** Rupees typed as text, to integer paise. Shared by the admin forms and the CSV import. */

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
