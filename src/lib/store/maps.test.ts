import { describe, expect, it, vi } from 'vitest';
import { loadGoogleMaps } from './maps';

// A page without a map key, or one where Google's script is blocked, must not break the form:
// the loader has to answer "no map" quickly, and a failure must not stick.
describe('loadGoogleMaps', () => {
	const fakeDoc = (onAppend: (script: { onerror: (() => void) | null }) => void) => {
		const append = vi.fn(onAppend);
		return {
			append,
			doc: {
				createElement: () => ({ src: '', async: false, onerror: null as (() => void) | null }),
				head: { appendChild: append }
			}
		};
	};

	it('answers "no map" without touching the page when there is no key', async () => {
		const { doc, append } = fakeDoc(() => {});
		await expect(loadGoogleMaps(undefined, { doc })).resolves.toBeNull();
		await expect(loadGoogleMaps('', { doc })).resolves.toBeNull();
		expect(append).not.toHaveBeenCalled();
	});

	it('gives up on a script that never answers', async () => {
		vi.stubGlobal('window', {});
		const { doc } = fakeDoc(() => {});
		await expect(loadGoogleMaps('test-key', { doc, timeoutMs: 20 })).resolves.toBeNull();
		vi.unstubAllGlobals();
	});
});
