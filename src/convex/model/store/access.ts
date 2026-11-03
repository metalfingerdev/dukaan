/**
 * Access guards for store functions. Every store query and mutation calls exactly one of these
 * (or is deliberately public and returns only public fields). Page checks are UX only; these are
 * the security boundary. See .agents/skills/store-app/references/roles-and-access.md.
 */
import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { authComponent } from '../../auth';
import { getIsAppAdmin } from '../admin';

export { requireAppAdmin } from '../admin';

type Ctx = QueryCtx | MutationCtx;

// One message for every partner refusal, so a response doesn't reveal who is a partner
const NOT_A_PARTNER = 'Not a delivery partner';

/** Any signed-in user. Throws when signed out. */
export const requireCustomer = async (ctx: Ctx) => {
	return await authComponent.getAuthUser(ctx);
};

/**
 * The active `deliveryPartners` row whose number is the user's verified phone, or `null`.
 * Only a verified number counts: otherwise anyone could put a partner's number on their own
 * account and see that partner's orders.
 */
const findPartnerForUser = async (
	ctx: Ctx,
	user: { phoneNumber?: string | null; phoneNumberVerified?: boolean | null }
) => {
	if (!user.phoneNumber || !user.phoneNumberVerified) return null;
	const phoneNumber = user.phoneNumber;
	const partner = await ctx.db
		.query('deliveryPartners')
		.withIndex('by_phoneNumber', (q) => q.eq('phoneNumber', phoneNumber))
		.unique();
	return partner?.isActive ? partner : null;
};

/** A signed-in, active delivery partner. Returns the user and their `deliveryPartners` row. */
export const requireDeliveryPartner = async (ctx: Ctx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	if (!user) throw new ConvexError(NOT_A_PARTNER);
	const partner = await findPartnerForUser(ctx, user);
	if (!partner) throw new ConvexError(NOT_A_PARTNER);
	return { user, partner };
};

/** Which store areas the current user may open. Never throws; for showing links, not for access. */
export const getStoreRoles = async (ctx: Ctx) => {
	const user = await authComponent.safeGetAuthUser(ctx);
	if (!user) return { isSignedIn: false, isAdmin: false, isPartner: false };
	const [isAdmin, partner] = await Promise.all([getIsAppAdmin(ctx), findPartnerForUser(ctx, user)]);
	return { isSignedIn: true, isAdmin, isPartner: partner !== null };
};
