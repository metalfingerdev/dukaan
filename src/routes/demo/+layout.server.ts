import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import { PUBLIC_APP_ENV } from '$app/env/public';
import type { LayoutServerLoad } from './$types';

// Design scratch pad: available locally and on staging, never on the real production site
// (where PUBLIC_APP_ENV is unset). Delete src/routes/demo once the redesign has landed.
export const load: LayoutServerLoad = () => {
	if (!dev && PUBLIC_APP_ENV !== 'staging') error(404, 'Not found');
};
