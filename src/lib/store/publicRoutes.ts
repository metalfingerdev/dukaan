/**
 * Storefront routes a signed-out visitor may open, in the pattern syntax of `createRouteMatcher`.
 * Browsing is public so a visitor can fill a cart before signing in; everything else stays
 * private by default (src/hooks.server.ts). The route check is UX only: the Convex functions
 * these pages call decide what data comes back.
 */
export const STORE_PUBLIC_ROUTES = ['/c{/*rest}', '/p{/*rest}', '/search', '/cart'];
