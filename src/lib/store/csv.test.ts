import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('csv', () => {
	it('reads quoted commas, quotes and line breaks without shifting cells', () => {
		const text = 'name,unit\r\n"Dal, split","1 ""kg"""\r\n"two\nlines",x\r\n\r\n';
		expect(parseCsv(text)).toEqual([
			['name', 'unit'],
			['Dal, split', '1 "kg"'],
			['two\nlines', 'x']
		]);
	});

	it('writes what it reads back, including a spreadsheet byte-order mark', () => {
		const rows = [['a', 'b,c'], ['"q"', 'x\ny']];
		expect(parseCsv(toCsv(rows))).toEqual(rows);
	});
});
