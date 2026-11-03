import { describe, expect, it } from 'vitest';
import { isValidSlot, listSlots } from './slots';

// IST is UTC+5:30, so 09:00 IST is 03:30 UTC
const ist = (day: number, hour: number, minute = 0) =>
	Date.UTC(2026, 10, day, hour, minute) - 5.5 * 60 * 60 * 1000;
const istHour = (ms: number) => new Date(ms + 5.5 * 60 * 60 * 1000).getUTCHours();

const hours = { opensAtMinute: 9 * 60, closesAtMinute: 21 * 60 };

describe('listSlots', () => {
	it('offers every hour slot from the first one at least 30 minutes away', () => {
		// 10:15 now: earliest start is 10:45, so the first slot is 11:00 and the last is 20:00-21:00
		const slots = listSlots(hours, ist(3, 10, 15));
		expect(slots.map(istHour)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
	});

	it('includes a slot that starts exactly 30 minutes away, not one minute sooner', () => {
		expect(listSlots(hours, ist(3, 10, 30))[0]).toBe(ist(3, 11));
		expect(listSlots(hours, ist(3, 10, 31))[0]).toBe(ist(3, 12));
	});

	it('never offers a slot that would run past closing time', () => {
		const odd = { opensAtMinute: 9 * 60, closesAtMinute: 20 * 60 + 30 };
		const slots = listSlots(odd, ist(3, 7, 0));
		// 20:00-21:00 would end after 20:30 closing
		expect(slots.map(istHour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
	});

	it('never offers tomorrow', () => {
		const slots = listSlots(hours, ist(3, 12, 0));
		expect(slots.every((start) => start < ist(4, 0))).toBe(true);
	});

	it('handles hours that run past midnight, in the evening and after midnight', () => {
		const late = { opensAtMinute: 22 * 60, closesAtMinute: 2 * 60 };
		// At 20:00: tonight's slots from 22:00 to 23:00 (the ones after midnight are tomorrow's)
		expect(listSlots(late, ist(3, 20, 0)).map(istHour)).toEqual([22, 23]);
		// At 00:30 the window that began yesterday is still open until 02:00: one slot left, 01:00-02:00
		expect(listSlots(late, ist(4, 0, 15)).map(istHour)).toEqual([1, 22, 23]);
	});
});

describe('isValidSlot', () => {
	it('accepts exactly the slots that are listed', () => {
		const now = ist(3, 10, 15);
		expect(isValidSlot(hours, now, ist(3, 11))).toBe(true);
		expect(isValidSlot(hours, now, ist(3, 11) + 1)).toBe(false); // not on the hour
		expect(isValidSlot(hours, now, ist(3, 10))).toBe(false); // too soon
		expect(isValidSlot(hours, now, ist(3, 21))).toBe(false); // after closing
		expect(isValidSlot(hours, now, ist(4, 11))).toBe(false); // tomorrow
	});
});
