import { v } from 'convex/values';
import { query } from '../_generated/server';
import { AUTH_CONSTANTS } from '../auth.constants';
import { getStoreRoles } from '../model/store/access';

/**
 * Which store areas the signed-in user may open, for the header and user menu ("Admin",
 * "Delivery"). UX only: /admin and /delivery functions check access themselves.
 */
export const myRoles = query({
	args: {},
	returns: v.object({ isSignedIn: v.boolean(), isAdmin: v.boolean(), isPartner: v.boolean() }),
	handler: async (ctx) => {
		const roles = await getStoreRoles(ctx);
		return { ...roles, isAdmin: AUTH_CONSTANTS.admin === true && roles.isAdmin };
	}
});
