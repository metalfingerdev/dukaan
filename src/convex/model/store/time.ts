/**
 * Store time is India time (IST, UTC+5:30, no daylight saving). Queries can't read the clock, so
 * callers pass `nowMs` in; mutations may use `Date.now()`.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** The start of the IST day containing `nowMs`, as a UTC timestamp */
export const istDayStartMs = (nowMs: number) =>
	Math.floor((nowMs + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;

/** Minutes after midnight IST, 0 to 1439 */
export const istMinuteOfDay = (nowMs: number) =>
	Math.floor((((nowMs + IST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / MINUTE_MS);

export type OpeningHours = { isOpen: boolean; opensAtMinute: number; closesAtMinute: number };

/**
 * Whether the store takes orders at `nowMs`: the manual switch is on and the time falls in
 * [opensAtMinute, closesAtMinute). Hours that wrap past midnight (opens 22:00, closes 02:00) work
 * too. Equal opening and closing minutes mean closed all day.
 */
export const isOpenNow = (hours: OpeningHours, nowMs: number) => {
	if (!hours.isOpen) return false;
	const minute = istMinuteOfDay(nowMs);
	const { opensAtMinute: opens, closesAtMinute: closes } = hours;
	if (opens === closes) return false;
	return opens < closes ? minute >= opens && minute < closes : minute >= opens || minute < closes;
};
