import { toast } from 'svelte-sonner';
import { strings } from '#lib/store/strings.js';

const SOUND_KEY = 'dukaan.admin.orderSound';
const FLASH_MS = 1000;

const readSoundSetting = () => {
	try {
		return localStorage.getItem(SOUND_KEY) === 'on';
	} catch {
		return false;
	}
};

const saveSoundSetting = (on: boolean) => {
	try {
		localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
	} catch {
		// private window or blocked storage: the switch just won't be remembered
	}
};

let audio: AudioContext | undefined;

/** Two short tones. Browsers keep audio locked until the page has had a tap, hence the try/catch. */
const playTone = async () => {
	try {
		audio ??= new AudioContext();
		if (audio.state === 'suspended') await audio.resume();
		const start = audio.currentTime;
		for (const [i, hz] of [880, 1175].entries()) {
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			osc.frequency.value = hz;
			gain.gain.setValueAtTime(0.2, start + i * 0.25);
			gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.25 + 0.22);
			osc.connect(gain).connect(audio.destination);
			osc.start(start + i * 0.25);
			osc.stop(start + i * 0.25 + 0.25);
		}
	} catch {
		// no audio available or still locked: the toast and the title still tell the admin
	}
};

/**
 * Tells the admin when a new order arrives: a toast, the tab title flashing "(2) New order" while
 * the tab is in the background, and an optional tone. The first list that loads is the baseline
 * (orders already waiting don't beep on page load); only ids that appear after it count as new.
 * Call during component initialization.
 */
export function createOrderAlerts(getNewOrderIds: () => string[] | undefined) {
	let soundOn = $state(false);
	let unseen = $state(0);
	let known: Set<string> | undefined;

	$effect(() => {
		soundOn = readSoundSetting();
	});

	$effect(() => {
		const ids = getNewOrderIds();
		if (ids === undefined) return;
		if (known === undefined) {
			known = new Set(ids);
			return;
		}
		const arrived = ids.filter((id) => !known!.has(id));
		known = new Set(ids);
		if (arrived.length === 0) return;
		toast.success(strings.admin.board.newOrder(arrived.length));
		if (soundOn) void playTone();
		if (document.hidden) unseen += arrived.length;
	});

	// Flash the tab title until the admin comes back to the tab
	$effect(() => {
		if (unseen === 0) return;
		const original = document.title;
		let showAlert = true;
		const tick = () => {
			document.title = showAlert ? strings.admin.board.newOrderTitle(unseen) : original;
			showAlert = !showAlert;
		};
		tick();
		const id = setInterval(tick, FLASH_MS);
		const clear = () => {
			if (!document.hidden) unseen = 0;
		};
		document.addEventListener('visibilitychange', clear);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', clear);
			document.title = original;
		};
	});

	return {
		get soundOn() {
			return soundOn;
		},
		/** Called from a tap, which is what unlocks audio; turning it on plays the tone as a test */
		toggleSound() {
			soundOn = !soundOn;
			saveSoundSetting(soundOn);
			if (soundOn) void playTone();
		}
	};
}
