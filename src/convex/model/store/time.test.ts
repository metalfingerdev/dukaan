import { describe, expect, it } from 'vitest';
import { isOpenNow, istDayStartMs, istMinuteOfDay } from './time';

// IST is UTC+5:30, so 09:00 IST is 03:30 UTC
const ist = (day: number, hour: number, minute = 0) =>
	Date.UTC(2026, 10, day, hour, minute) - 5.5 * 60 * 60 * 1000;

const hours = { isOpen: true, opensAtMinute: 9 * 60, closesAtMinute: 21 * 60 };

describe('IST time', () => {
	it('finds the start of the IST day, which is 18:30 UTC the evening before', () => {
		const midnightIst = Date.UTC(2026, 10, 2, 18, 30);
		expect(istDayStartMs(midnightIst)).toBe(midnightIst);
		expect(istDayStartMs(midnightIst + 60 * 60 * 1000)).toBe(midnightIst);
		expect(istDayStartMs(midnightIst - 1)).toBe(midnightIst - 24 * 60 * 60 * 1000);
	});

	it('reads the minute of the IST day', () => {
		expect(istMinuteOfDay(ist(3, 0, 0))).toBe(0);
		expect(istMinuteOfDay(ist(3, 9, 30))).toBe(9 * 60 + 30);
		expect(istMinuteOfDay(ist(3, 23, 59))).toBe(23 * 60 + 59);
	});
});

describe('isOpenNow', () => {
	it('is open from the opening minute up to, not including, the closing minute', () => {
		expect(isOpenNow(hours, ist(3, 8, 59))).toBe(false);
		expect(isOpenNow(hours, ist(3, 9, 0))).toBe(true);
		expect(isOpenNow(hours, ist(3, 20, 59))).toBe(true);
		expect(isOpenNow(hours, ist(3, 21, 0))).toBe(false);
	});

	it('is closed whenever the manual switch is off', () => {
		expect(isOpenNow({ ...hours, isOpen: false }, ist(3, 12))).toBe(false);
	});

	it('handles hours that wrap past midnight', () => {
		const late = { isOpen: true, opensAtMinute: 22 * 60, closesAtMinute: 2 * 60 };
		expect(isOpenNow(late, ist(3, 23))).toBe(true);
		expect(isOpenNow(late, ist(4, 1))).toBe(true);
		expect(isOpenNow(late, ist(4, 2))).toBe(false);
		expect(isOpenNow(late, ist(3, 12))).toBe(false);
	});

	it('treats equal opening and closing minutes as closed all day', () => {
		expect(isOpenNow({ isOpen: true, opensAtMinute: 600, closesAtMinute: 600 }, ist(3, 10))).toBe(
			false
		);
	});
});
