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


export const ALBUM_ASSET_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export const AlbumAssetUploadMimeType = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export type AlbumAssetUploadMimeType = z.infer<typeof AlbumAssetUploadMimeType>;

export const PresignAlbumAssetInput = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: AlbumAssetUploadMimeType,
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(ALBUM_ASSET_UPLOAD_MAX_BYTES),
});
export type PresignAlbumAssetInput = z.infer<typeof PresignAlbumAssetInput>;

export const PresignAlbumAssetResponseSchema = z.object({
  assetId: AlbumAssetId,
  uploadToken: z.string().min(32).max(256),
  method: z.literal('PUT'),
  uploadUrl: z.string().url(),
  headers: z.object({
    'Content-Type': AlbumAssetUploadMimeType,
  }),
  expiresAt: z.string().datetime(),
  completeBy: z.string().datetime(),
});
export type PresignAlbumAssetResponse = z.infer<
  typeof PresignAlbumAssetResponseSchema
>;

export const CompleteAlbumAssetUploadInput = z.object({
  uploadToken: z.string().min(32).max(256),
});
export type CompleteAlbumAssetUploadInput = z.infer<
  typeof CompleteAlbumAssetUploadInput
>;
