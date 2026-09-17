import type { AlbumVisibility } from '@irec/contracts';

export type AlbumReadPolicyInput = {
  visibility: AlbumVisibility;
  ownerId: string;
  viewerId?: string;
  hasActiveMembership: boolean;
};

export function canReadAlbum(input: AlbumReadPolicyInput): boolean {
  if (input.visibility === 'public') return true;
  if (!input.viewerId) return false;
  if (input.ownerId === input.viewerId) return true;
  return input.hasActiveMembership;
}

export function canUpdateAlbum(ownerId: string, viewerId: string): boolean {
  return ownerId === viewerId;
}
