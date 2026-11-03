/**
 * Loads the Google Maps JavaScript API on demand. The map is a bonus on the address form, never a
 * requirement, so every failure here (no key, blocked script, slow network, a bad key) means
 * "return null and let the form carry on without a map". Only the few parts of the API the pin
 * picker uses are typed, to avoid a dependency on Google's type package.
 */

export type LatLngValue = { lat: number; lng: number };

export interface MapInstance {
	getCenter(): { lat(): number; lng(): number } | undefined;
	setCenter(center: LatLngValue): void;
	setZoom(zoom: number): void;
}

export interface GeocodeResult {
	formatted_address: string;
	geometry: { location: { lat(): number; lng(): number } };
}

export interface MapsApi {
	Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
	Geocoder: new () => {
		geocode(request: {
			address?: string;
			location?: LatLngValue;
		}): Promise<{ results: GeocodeResult[] }>;
	};
}

type ScriptLike = { src: string; async: boolean; onerror: (() => void) | null };
type DocumentLike = {
	createElement(tag: 'script'): ScriptLike;
	head: { appendChild(script: ScriptLike): unknown };
};

declare global {
	interface Window {
		__dukaanMapsReady?: () => void;
		google?: {
			maps: { importLibrary(name: string): Promise<Record<string, unknown>> };
		};
	}
}

let loading: Promise<MapsApi | null> | null = null;

export function loadGoogleMaps(
	key: string | undefined,
	{ timeoutMs = 10_000, doc = document as unknown as DocumentLike } = {}
): Promise<MapsApi | null> {
	if (!key) return Promise.resolve(null);
	if (loading) return loading;

	const attempt = new Promise<MapsApi | null>((resolve) => {
		const timer = setTimeout(() => resolve(null), timeoutMs);
		const done = (api: MapsApi | null) => {
			clearTimeout(timer);
			resolve(api);
		};

		window.__dukaanMapsReady = async () => {
			try {
				const maps = await window.google!.maps.importLibrary('maps');
				const geocoding = await window.google!.maps.importLibrary('geocoding');
				done({ Map: maps.Map, Geocoder: geocoding.Geocoder } as unknown as MapsApi);
			} catch {
				done(null);
			}
		};

		const script = doc.createElement('script');
		script.async = true;
		script.src =
			`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
			`&v=weekly&loading=async&callback=__dukaanMapsReady`;
		script.onerror = () => done(null);
		doc.head.appendChild(script);
	});

	loading = attempt;
	// A failed load must not stick: the customer can open the picker again and retry
	void attempt.then((api) => {
		if (api === null && loading === attempt) loading = null;
	});
	return attempt;
}

/** A suggestion for the address text from a pin; the customer edits it before saving */
export async function suggestAddress(api: MapsApi, at: LatLngValue): Promise<string | null> {
	try {
		const { results } = await new api.Geocoder().geocode({ location: at });
		return results[0]?.formatted_address ?? null;
	} catch {
		return null;
	}
}

/** Where to open the map when the customer has no pin yet: the town, looked up by name once */
export async function findPlace(api: MapsApi, name: string): Promise<LatLngValue | null> {
	try {
		const { results } = await new api.Geocoder().geocode({ address: name });
		const spot = results[0]?.geometry.location;
		return spot ? { lat: spot.lat(), lng: spot.lng() } : null;
	} catch {
		return null;
	}
}
