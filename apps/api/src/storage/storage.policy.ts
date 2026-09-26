export function canManageStorageConnection(
  ownerId: string,
  viewerId: string,
): boolean {
  return ownerId === viewerId;
}
