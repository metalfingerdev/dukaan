/**
 * A clock that ticks, for "open now" and similar. Queries can't read the time, so the browser
 * supplies it. Call during component initialization; it stops itself when the component is destroyed.
 */
export function createClock(intervalMs = 30_000) {
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), intervalMs);
		return () => clearInterval(id);
	});
	return {
		get now() {
			return now;
		}
	};
}
