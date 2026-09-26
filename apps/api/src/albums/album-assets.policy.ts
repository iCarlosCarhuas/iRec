import type { AlbumAssetStatus } from '@irec/contracts';

export function initialAlbumAssetStatus(
  ownerId: string,
  uploaderId: string,
  hasActiveMembership: boolean,
): AlbumAssetStatus | null {
  if (ownerId === uploaderId) return 'approved';
  if (hasActiveMembership) return 'pending';
  return null;
}

export function canModerateAlbumAssets(
  ownerId: string,
  viewerId: string,
): boolean {
  return ownerId === viewerId;
}

export function canSeeAlbumAsset(
  status: AlbumAssetStatus,
  ownerId: string,
  uploadedBy: string,
  viewerId: string | undefined,
  hasActiveMembership: boolean,
): boolean {
  if (viewerId === ownerId) return true;
  if (status === 'approved') return true;

  return Boolean(
    viewerId &&
      hasActiveMembership &&
      uploadedBy === viewerId,
  );
}
