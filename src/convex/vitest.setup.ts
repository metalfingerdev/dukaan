/**
 * Runs before every Vitest file (`setupFiles` in vitest.config.ts). The name has two dots, so
 * Convex never deploys it.
 *
 * The real access guards read the user through the Better Auth component, which convex-test
 * doesn't mount. These stand-ins keep the guards' promises, so store logic, ownership and refusals
 * can be tested: a signed-out caller is refused, the user id comes from the session (never from an
 * argument), and only the identity with subject "admin" is the store admin. The real guards
 * (model/store/access.ts, model/admin) are thin wrappers over `authComponent.getAuthUser`, and are
 * checked against a real deployment by the Playwright suite in tests/e2e.
 */
import { vi } from 'vitest';

vi.mock('./model/store/access', async () => {
	const { ConvexError } = await import('convex/values');
	type Ctx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };

	const requireCustomer = async (ctx: Ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new ConvexError('Not authenticated');
		return { _id: identity.subject };
	};

	const requireAppAdmin = async (ctx: Ctx) => {
		const user = await requireCustomer(ctx);
		if (user._id !== 'admin') throw new ConvexError('Forbidden: application admin role required');
		return user;
	};

	return { requireCustomer, requireAppAdmin };
});
