/**
 * Delivery time slots for "today" in IST: one-hour slots inside opening hours, the first at least
 * 30 minutes away (`SLOT_MINUTES`, `SLOT_NOTICE_MINUTES` in storeProfile.ts). Pure, so the checkout
 * page lists exactly the slots `placeOrder` will accept. "As soon as possible" needs no slot.
 */
import { istDayStartMs } from './time';
import { SLOT_MINUTES, SLOT_NOTICE_MINUTES } from './storeProfile';

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

export type SlotHours = { opensAtMinute: number; closesAtMinute: number };

/**
 * Start times (UTC ms) of the slots a customer may pick at `nowMs`. Opening hours that run past
 * midnight (opens 22:00, closes 02:00) are handled by also looking at the window that began
 * yesterday. Slots that would start tomorrow are not offered. Equal opening and closing minutes
 * mean closed all day, so no slots.
 */
export function listSlots(hours: SlotHours, nowMs: number): number[] {
	const { opensAtMinute: opens, closesAtMinute: closes } = hours;
	if (opens === closes) return [];

	const dayStart = istDayStartMs(nowMs);
	const windowMinutes = closes > opens ? closes - opens : closes + DAY_MINUTES - opens;
	const earliest = nowMs + SLOT_NOTICE_MINUTES * MINUTE_MS;
	const endOfToday = dayStart + DAY_MINUTES * MINUTE_MS;

	const slots: number[] = [];
	for (const dayOffset of [-1, 0]) {
		const windowStart = dayStart + (dayOffset * DAY_MINUTES + opens) * MINUTE_MS;
		const windowEnd = windowStart + windowMinutes * MINUTE_MS;
		for (
			let start = windowStart;
			start + SLOT_MINUTES * MINUTE_MS <= windowEnd;
			start += SLOT_MINUTES * MINUTE_MS
		) {
			if (start >= earliest && start < endOfToday) slots.push(start);
		}
	}
	return slots;
}

export const isValidSlot = (hours: SlotHours, nowMs: number, slotStartMs: number) =>
	listSlots(hours, nowMs).includes(slotStartMs);
