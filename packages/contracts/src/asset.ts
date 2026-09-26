import { z } from 'zod';

import { AlbumId } from './album.js';

export const AlbumAssetStatus = z.enum(['pending', 'approved', 'rejected']);
export type AlbumAssetStatus = z.infer<typeof AlbumAssetStatus>;

export const AlbumAssetId = z.string().uuid();
export type AlbumAssetId = z.infer<typeof AlbumAssetId>;

export const AlbumAssetParamsSchema = z.object({
  albumId: AlbumId,
  assetId: AlbumAssetId,
});
export type AlbumAssetParams = z.infer<typeof AlbumAssetParamsSchema>;

export const AlbumAssetContract = z.object({
  id: AlbumAssetId,
  albumId: AlbumId,
  uploadedBy: z.string().uuid(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  status: AlbumAssetStatus,
  uploadedAt: z.string().datetime().nullable(),
  moderatedBy: z.string().uuid().nullable(),
  moderatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AlbumAssetContract = z.infer<typeof AlbumAssetContract>;

export const AlbumAssetsResponseSchema = z.object({
  assets: z.array(AlbumAssetContract),
});
export type AlbumAssetsResponse = z.infer<typeof AlbumAssetsResponseSchema>;
