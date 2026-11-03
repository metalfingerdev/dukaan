/**
 * A signed-in customer's saved delivery addresses. Every function calls `requireCustomer` and takes
 * no user id; ownership is checked on every id, and a missing address and someone else's address
 * get the same answer so ids can't be probed. The browser's values are validated and cleaned in
 * `model/store/address.ts`. See .agents/skills/store-app/references/customer.md.
 */
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { mutation, query } from '../_generated/server';
import { MAX_ADDRESSES_PER_USER, validateAddress } from '../model/store/address';
import { requireCustomer } from '../model/store/access';
import { addressKind } from './validators';

const savedAddress = v.object({
	_id: v.id('addresses'),
	label: v.string(),
	kind: addressKind,
	line1: v.string(),
	area: v.string(),
	landmark: v.optional(v.string()),
	contactName: v.string(),
	contactPhone: v.string(),
	lat: v.optional(v.number()),
	lng: v.optional(v.number()),
	mapsUrl: v.optional(v.string()),
	isDefault: v.boolean()
});

const toSavedAddress = (address: Doc<'addresses'>) => ({
	_id: address._id,
	label: address.label,
	kind: address.kind,
	line1: address.line1,
	area: address.area,
	landmark: address.landmark,
	contactName: address.contactName,
	contactPhone: address.contactPhone,
	lat: address.lat,
	lng: address.lng,
	mapsUrl: address.mapsUrl,
	isDefault: address.isDefault
});

const userAddresses = (ctx: QueryCtx | MutationCtx, userId: string) =>
	ctx.db
		.query('addresses')
		.withIndex('by_userId', (q) => q.eq('userId', userId))
		.take(MAX_ADDRESSES_PER_USER + 1);

/** The address, only if it belongs to `userId`; otherwise the same error as for a missing one */
const ownedAddress = async (ctx: MutationCtx, userId: string, id: Id<'addresses'>) => {
	const address = await ctx.db.get(id);
	if (!address || address.userId !== userId) throw new ConvexError({ code: 'ADDRESS_NOT_FOUND' });
	return address;
};

const deliveryAreas = async (ctx: QueryCtx | MutationCtx) => {
	const settings = await ctx.db.query('storeSettings').first();
	if (!settings) throw new ConvexError({ code: 'STORE_NOT_SET_UP' });
	return settings.deliveryAreas;
};

/** The customer's addresses, default first */
export const listAddresses = query({
	args: {},
	returns: v.array(savedAddress),
	handler: async (ctx) => {
		const user = await requireCustomer(ctx);
		const addresses = await userAddresses(ctx, user._id);
		return addresses
			.slice(0, MAX_ADDRESSES_PER_USER)
			.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
			.map(toSavedAddress);
	}
});

/**
 * Creates an address, or updates one when `id` is given. The first address becomes the default;
 * `makeDefault` moves the default to this one.
 */
export const saveAddress = mutation({
	args: {
		id: v.optional(v.id('addresses')),
		label: v.string(),
		kind: addressKind,
		line1: v.string(),
		area: v.string(),
		landmark: v.optional(v.string()),
		contactName: v.string(),
		contactPhone: v.string(),
		lat: v.optional(v.number()),
		lng: v.optional(v.number()),
		mapsUrl: v.optional(v.string()),
		makeDefault: v.optional(v.boolean())
	},
	returns: v.object({ addressId: v.id('addresses') }),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const { id, makeDefault, ...input } = args;
		const clean = validateAddress(input, await deliveryAreas(ctx));
		const existing = await userAddresses(ctx, user._id);

		let addressId: Id<'addresses'>;
		if (id) {
			const owned = await ownedAddress(ctx, user._id, id);
			// replace, not patch: dropping the landmark or the location must really remove it
			await ctx.db.replace(id, { ...clean, userId: user._id, isDefault: owned.isDefault });
			addressId = id;
		} else {
			if (existing.length >= MAX_ADDRESSES_PER_USER) {
				throw new ConvexError({ code: 'TOO_MANY_ADDRESSES', max: MAX_ADDRESSES_PER_USER });
			}
			addressId = await ctx.db.insert('addresses', {
				...clean,
				userId: user._id,
				isDefault: existing.length === 0
			});
		}

		if (makeDefault) {
			for (const other of existing) {
				if (other._id !== addressId && other.isDefault) {
					await ctx.db.patch(other._id, { isDefault: false });
				}
			}
			await ctx.db.patch(addressId, { isDefault: true });
		}
		return { addressId };
	}
});

export const setDefaultAddress = mutation({
	args: { id: v.id('addresses') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		await ownedAddress(ctx, user._id, args.id);
		for (const address of await userAddresses(ctx, user._id)) {
			const shouldBeDefault = address._id === args.id;
			if (address.isDefault !== shouldBeDefault) {
				await ctx.db.patch(address._id, { isDefault: shouldBeDefault });
			}
		}
		return null;
	}
});

/** Deletes an address. If it was the default, the oldest remaining one becomes the default. */
export const deleteAddress = mutation({
	args: { id: v.id('addresses') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireCustomer(ctx);
		const address = await ownedAddress(ctx, user._id, args.id);
		await ctx.db.delete(address._id);
		if (address.isDefault) {
			const remaining = (await userAddresses(ctx, user._id)).sort(
				(a, b) => a._creationTime - b._creationTime
			);
			if (remaining[0]) await ctx.db.patch(remaining[0]._id, { isDefault: true });
		}
		return null;
	}
});
