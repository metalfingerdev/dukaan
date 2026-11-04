/**
 * A small CSV reader and writer (RFC 4180): quoted cells may hold commas, line breaks and doubled
 * quotes. Spreadsheets save files with a byte-order mark and CRLF line ends; both are handled.
 */

/** The cells of every line. A line that is empty (or only commas) is dropped. */
export function parseCsv(input: string): string[][] {
	const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	let touched = false; // anything seen on this line, so "" counts as a cell

	const endCell = () => {
		row.push(cell);
		cell = '';
	};
	const endRow = () => {
		endCell();
		if (touched && row.some((value) => value.trim() !== '')) rows.push(row);
		row = [];
		touched = false;
	};

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					cell += '"';
					i++;
				} else quoted = false;
			} else cell += char;
		} else if (char === '"' && cell === '') {
			quoted = true;
			touched = true;
		} else if (char === ',') {
			endCell();
			touched = true;
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++;
			endRow();
		} else {
			cell += char;
			touched = true;
		}
	}
	if (touched || cell !== '') endRow();
	return rows;
}

const quote = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Lines of cells as CSV text, with CRLF line ends and a byte-order mark so Excel reads it as UTF-8 */
export const toCsv = (rows: string[][]) =>
	'﻿' + rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
