import { describe, expect, it } from 'vitest';
import { createRouteMatcher } from '../primitives/utils/routeMatcher';
import { STORE_PUBLIC_ROUTES } from './publicRoutes';

const isPublic = createRouteMatcher(STORE_PUBLIC_ROUTES);

describe('storefront public routes', () => {
	it('opens the browsing pages to signed-out visitors', () => {
		expect(isPublic('/c/dairy-eggs')).toBe(true);
		expect(isPublic('/p/toned-milk-500ml')).toBe(true);
		expect(isPublic('/search')).toBe(true);
	});

	it('does not open anything else', () => {
		for (const path of [
			'/checkout',
			'/orders',
			'/orders/abc',
			'/account/addresses',
			'/admin',
			'/admin/products',
			'/delivery',
			'/cart/x',
			'/cat',
			'/product',
			'/searching'
		]) {
			expect(isPublic(path), path).toBe(false);
		}
	});
});
