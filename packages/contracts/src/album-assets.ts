import { z } from 'zod';

export const AlbumAssetProvider = z.literal('google_drive');
export type AlbumAssetProvider = z.infer<typeof AlbumAssetProvider>;

export const AlbumAssetMime = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
]);
export type AlbumAssetMime = z.infer<typeof AlbumAssetMime>;

export const AlbumAssetStatus = z.enum([
  'pending',
  'ready',
  'failed',
  'deleted',
]);
export type AlbumAssetStatus = z.infer<typeof AlbumAssetStatus>;

// Placeholder cap until the upload-byte design lands.
// Drive owns bytes; PG only stores this metadata guard.
export const MAX_ALBUM_ASSET_SIZE_BYTES = 100 * 1024 * 1024;

export const AlbumAssetId = z.string().uuid();
export type AlbumAssetId = z.infer<typeof AlbumAssetId>;

export const AlbumAssetParamsSchema = z.object({
  albumId: z.string().uuid(),
  assetId: AlbumAssetId,
});
export type AlbumAssetParams = z.infer<typeof AlbumAssetParamsSchema>;

export const CreateAlbumAssetInput = z.object({
  storageConnectionId: z.string().uuid(),
  mimeType: AlbumAssetMime,
  originalName: z.string().trim().min(1).max(255),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_ALBUM_ASSET_SIZE_BYTES),
});
export type CreateAlbumAssetInput = z.infer<typeof CreateAlbumAssetInput>;

export const FinalizeAlbumAssetInput = z.object({
  providerFileId: z.string().trim().min(1).max(1024),
});
export type FinalizeAlbumAssetInput = z.infer<
  typeof FinalizeAlbumAssetInput
>;

export const AlbumAssetContract = z.object({
  id: AlbumAssetId,
  albumId: z.string().uuid(),
  uploadedBy: z.string().uuid(),
  storageConnectionId: z.string().uuid(),
  provider: AlbumAssetProvider,
  providerFileId: z.string().nullable(),
  mimeType: AlbumAssetMime,
  originalName: z.string(),
  sizeBytes: z.number().int(),
  status: AlbumAssetStatus,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AlbumAssetContract = z.infer<typeof AlbumAssetContract>;

export const AlbumAssetsResponseSchema = z.object({
  assets: z.array(AlbumAssetContract),
});
export type AlbumAssetsResponse = z.infer<typeof AlbumAssetsResponseSchema>;
