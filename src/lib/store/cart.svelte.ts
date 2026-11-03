import { browser } from '$app/env';
import { useConvexClient, useQuery } from 'convex-svelte';
import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
import { api } from '#convex/_generated/api.js';
import { priceCart } from '#convex/model/store/pricing.js';
import type { PublicProduct } from './types.js';

const STORAGE_KEY = 'store.cart.v1';
const MAX_GUEST_LINES = 50;

type GuestLine = { productId: string; quantity: number };

export type CartLine = {
	productId: string;
	/** What is stored; may be above `product.maxQuantity` if stock dropped since */
	quantity: number;
	product: PublicProduct;
};

export type SetQuantityResult = 'ok' | 'clamped' | 'out_of_stock' | 'unavailable' | 'error';

/** What a line can really be bought at right now */
export const effectiveQuantity = (line: Pick<CartLine, 'quantity' | 'product'>) =>
	Math.min(line.quantity, line.product.maxQuantity);

// Storage can be blocked or hold anything, so every access is wrapped and the shape is checked
const readGuestLines = (): GuestLine[] => {
	if (!browser) return [];
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { lines?: unknown }).lines)) {
			return [];
		}
		const lines: GuestLine[] = [];
		for (const line of (parsed as { lines: unknown[] }).lines) {
			const { productId, quantity } = (line ?? {}) as Partial<GuestLine>;
			if (typeof productId === 'string' && Number.isSafeInteger(quantity) && quantity! > 0) {
				lines.push({ productId, quantity: quantity! });
			}
			if (lines.length >= MAX_GUEST_LINES) break;
		}
		return lines;
	} catch {
		return [];
	}
};

const writeGuestLines = (lines: GuestLine[]) => {
	if (!browser) return;
	try {
		if (lines.length === 0) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, lines }));
	} catch {
		// Blocked or full: the cart then lasts only until the page closes
	}
};

/**
 * The customer's cart. A guest's lines live in localStorage (no prices, which are looked up live
 * so a stale cart never shows a stale price); once signed in they live in Convex (`cartItems`)
 * and any guest lines are merged in once. Create it once, during component initialization, in the
 * root layout, and read it elsewhere through `getCartContext()`.
 */
export class Cart {
	#auth = useAuth();
	#client = useConvexClient();
	#guestLines = $state<GuestLine[]>(readGuestLines());
	#merging = false;

	#serverCart = useQuery(api.store.cart.getCart, () => (this.#auth.isAuthenticated ? {} : 'skip'));
	// keepPreviousData: changing the ids re-runs the query, and without it the cart page would flash
	// to its loading state on every tap
	#guestProducts = useQuery(
		api.store.catalog.getProductsByIds,
		() =>
			!this.#auth.isAuthenticated && this.#guestLines.length > 0
				? { ids: this.#guestLines.map((line) => line.productId) }
				: 'skip',
		() => ({ keepPreviousData: true })
	);
	// Products the guest added on this page, so a new line shows at once instead of after the query
	#known = $state<Record<string, PublicProduct>>({});
	#storeInfo = useQuery(api.store.catalog.getStoreInfo, {});

	constructor() {
		// Sign-in with guest lines: fold them into the signed-in cart once. Storage is cleared only
		// after the server confirms; the merge is idempotent, so a retry can't double anything.
		$effect(() => {
			if (!this.#auth.isAuthenticated || this.#guestLines.length === 0 || this.#merging) return;
			void this.#merge();
		});
	}

	async #merge() {
		this.#merging = true;
		try {
			const lines = $state.snapshot(this.#guestLines);
			await this.#client.mutation(api.store.cart.mergeGuestCart, { lines });
			this.#guestLines = [];
			writeGuestLines([]);
		} catch {
			// Keep the guest lines; the next page load or sign-in tries again
		} finally {
			this.#merging = false;
		}
	}

	/** Lines with current product details; unavailable products are left out */
	lines = $derived.by<CartLine[]>(() => {
		if (this.#auth.isAuthenticated) return this.#serverCart.data ?? [];
		const byId = new Map((this.#guestProducts.data ?? []).map((product) => [product._id as string, product]));
		return this.#guestLines.flatMap((line) => {
			// The fetched copy is fresher; the remembered one only bridges the gap while it loads
			const product = byId.get(line.productId) ?? this.#known[line.productId];
			return product ? [{ ...line, product }] : [];
		});
	});

	/**
	 * Items in the cart. A guest sees a count at once from storage, before product details have
	 * loaded; once they have, lines for products that no longer exist stop counting.
	 */
	count = $derived(
		this.#auth.isAuthenticated || this.#guestProducts.data !== undefined
			? this.lines.reduce((total, line) => total + effectiveQuantity(line), 0)
			: this.#guestLines.reduce((total, line) => total + line.quantity, 0)
	);

	/** True until the cart can be shown */
	isLoading = $derived(
		this.#auth.isLoading ||
			(this.#auth.isAuthenticated
				? this.#serverCart.data === undefined
				: this.#guestLines.length > 0 && this.#guestProducts.data === undefined)
	);

	storeInfo = $derived(this.#storeInfo.data ?? null);

	/** Totals from the shared pricing function, or `null` until the store's fees have loaded */
	pricing = $derived.by(() => {
		const info = this.#storeInfo.data;
		if (!info) return null;
		const priced = this.lines
			.map((line) => ({
				pricePaise: line.product.pricePaise,
				mrpPaise: line.product.mrpPaise,
				quantity: effectiveQuantity(line)
			}))
			.filter((line) => line.quantity > 0);
		return priceCart(priced, info);
	});

	quantityOf(productId: string) {
		if (this.#auth.isAuthenticated) {
			const line = this.lines.find((l) => l.productId === productId);
			return line ? effectiveQuantity(line) : 0;
		}
		return this.#guestLines.find((line) => line.productId === productId)?.quantity ?? 0;
	}

	/** Sets a line to `quantity` (0 removes it), clamped to what is available */
	async setQuantity(product: PublicProduct, quantity: number): Promise<SetQuantityResult> {
		if (this.#auth.isAuthenticated) {
			try {
				const result = await this.#client.mutation(api.store.cart.setQuantity, {
					productId: product._id,
					quantity
				});
				return result.status;
			} catch {
				return 'error';
			}
		}

		this.#known[product._id] = product;
		const limit = product.maxQuantity;
		if (quantity > 0 && limit === 0) {
			this.#setGuest(product._id, 0);
			return 'out_of_stock';
		}
		const allowed = Math.min(quantity, limit);
		this.#setGuest(product._id, allowed);
		return allowed < quantity ? 'clamped' : 'ok';
	}

	#setGuest(productId: string, quantity: number) {
		const others = this.#guestLines.filter((line) => line.productId !== productId);
		const next = quantity > 0 ? [...others, { productId, quantity }] : others;
		// Order is the order lines were added, so the cart doesn't jump around
		const order = new Map(this.#guestLines.map((line, index) => [line.productId, index]));
		next.sort((a, b) => (order.get(a.productId) ?? Infinity) - (order.get(b.productId) ?? Infinity));
		this.#guestLines = next.slice(0, MAX_GUEST_LINES);
		writeGuestLines(this.#guestLines);
	}
}
