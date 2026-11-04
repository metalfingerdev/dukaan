/**
 * Shrinks a photo in the browser and uploads it to Convex storage through the admin-only upload
 * URL, returning the storage id to save on the product. A phone photo is several MB; shrinking it
 * first keeps the upload quick on mobile data and the storefront light.
 */
import type { ConvexClient } from 'convex/browser';
import { api } from '#convex/_generated/api.js';
import type { Id } from '#convex/_generated/dataModel.js';
import { optimizeImage } from '#lib/primitives/utils/optimizeImage.js';

export async function uploadProductImage(client: ConvexClient, file: File): Promise<Id<'_storage'>> {
	const small = await optimizeImage(file, { maxWidth: 800, maxHeight: 800, maxSizeKB: 300 });
	const uploadUrl = await client.mutation(api.store.admin.products.generateImageUploadUrl, {});
	const response = await fetch(uploadUrl, {
		method: 'POST',
		headers: { 'Content-Type': small.type },
		body: small
	});
	if (!response.ok) throw new Error('Upload failed');
	const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
	return storageId;
}
