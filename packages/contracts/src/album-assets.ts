import { z } from 'zod';

export const AlbumAssetProvider = z.literal('google_drive');
export type AlbumAssetProvider = z.infer<typeof AlbumAssetProvider>;

export const AlbumAssetMime = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
export type AlbumAssetMime = z.infer<typeof AlbumAssetMime>;

/**
 * Smallest safe playable + storable set. svg/bmp/tiff/avi/mkv stay rejected
 * by default (security + preview cost). `image/jpg` is a common alias sent
 * by phones/cameras and normalizes to `image/jpeg`.
 */
export const ALLOWED_ALBUM_ASSET_MIMES: readonly string[] = AlbumAssetMime.options;

const JPG_ALIAS = 'image/jpg';

/** Normalizes client-sent mime aliases (`image/jpg` → `image/jpeg`). */
export function normalizeAlbumAssetMime(raw: unknown): AlbumAssetMime | null {
  if (typeof raw !== 'string') return null;
  const lowered = raw.trim().toLowerCase();
  const canonical = lowered === JPG_ALIAS ? 'image/jpeg' : lowered;
  const parsed = AlbumAssetMime.safeParse(canonical);
  return parsed.success ? parsed.data : null;
}

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

// Multipart upload (POST /albums/:albumId/assets/upload).
// File bytes travel as the `file` part; every other value is a text field.
// The client MUST send text fields before the file part and declare the exact
// byte length up front so mime/size guards run before any provider session.
export const UploadAlbumAssetFieldsSchema = z.object({
  storageConnectionId: z.string().uuid(),
  sizeBytes: z.coerce.number().int().positive().max(MAX_ALBUM_ASSET_SIZE_BYTES),
});
export type UploadAlbumAssetFields = z.infer<typeof UploadAlbumAssetFieldsSchema>;

export const UploadAlbumAssetMultipartSchema = UploadAlbumAssetFieldsSchema.extend({
  file: z
    .string()
    .describe(
      'Binary bytes (jpeg/jpg, png, webp, gif, heic, heif, mp4, mov, webm, <= 100MB). Must be the last part; sizeBytes must equal the exact file length.',
    ),
});
export type UploadAlbumAssetMultipart = z.infer<typeof UploadAlbumAssetMultipartSchema>;

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
