import type { AlbumAssetUploadMimeType } from '@irec/contracts';

const EXTENSION_BY_MIME: Record<AlbumAssetUploadMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const PHOTO_UPLOAD_PRESIGN_TTL_SECONDS = 300;
export const PHOTO_UPLOAD_INTENT_TTL_SECONDS = 900;

export function buildAlbumAssetObjectKey(
  albumId: string,
  assetId: string,
  mimeType: AlbumAssetUploadMimeType,
): string {
  return `albums/${albumId}/originals/${assetId}.${EXTENSION_BY_MIME[mimeType]}`;
}

export type CompletedUploadMetadata = {
  contentType: string | undefined;
  sizeBytes: number | undefined;
};

export function completedUploadMatches(
  expected: { mimeType: AlbumAssetUploadMimeType; sizeBytes: number },
  actual: CompletedUploadMetadata,
): boolean {
  return (
    actual.contentType?.toLowerCase() === expected.mimeType &&
    actual.sizeBytes === expected.sizeBytes
  );
}
