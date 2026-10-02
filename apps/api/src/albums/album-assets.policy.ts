import type { AlbumAssetStatus } from '@irec/contracts';

const STATUS_TRANSITIONS: Record<AlbumAssetStatus, AlbumAssetStatus[]> = {
  pending: ['ready', 'failed', 'deleted'],
  ready: ['deleted'],
  failed: ['deleted'],
  deleted: [],
};

export function canCreateAlbumAsset(
  ownerId: string,
  viewerId: string,
  hasActiveMembership: boolean,
): boolean {
  return ownerId === viewerId || hasActiveMembership;
}

export function canDeleteAlbumAsset(
  ownerId: string,
  uploaderId: string,
  viewerId: string,
  hasActiveMembership: boolean,
): boolean {
  if (ownerId === viewerId) return true;
  return uploaderId === viewerId && hasActiveMembership;
}

export function canFinalizeAlbumAsset(
  ownerId: string,
  uploaderId: string,
  viewerId: string,
  hasActiveMembership: boolean,
): boolean {
  return canDeleteAlbumAsset(ownerId, uploaderId, viewerId, hasActiveMembership);
}

export function canTransitionAlbumAssetStatus(
  from: AlbumAssetStatus,
  to: AlbumAssetStatus,
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
