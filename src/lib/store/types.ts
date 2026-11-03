import type { FunctionReturnType } from 'convex/server';
import type { api } from '#convex/_generated/api.js';

/** A product as the storefront receives it: the public projection, never the stored document */
export type PublicProduct = FunctionReturnType<typeof api.store.catalog.listFeatured>[number];

export type PublicCategory = FunctionReturnType<typeof api.store.catalog.listCategories>[number];
