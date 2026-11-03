import { createContext } from 'svelte';
import type { Cart } from './cart.svelte.js';

/**
 * Svelte context for the cart, the same pattern as `src/lib/auth/context.svelte.ts`.
 *
 * - `setCartContext` — call once in the root layout, after the auth client exists.
 * - `getCartContext` — call in any descendant component during initialization.
 */
export const [getCartContext, setCartContext] = createContext<Cart>();
