import type {
  StorageConnectionStatus,
  StorageProviderType,
} from './storage-provider.js';

export interface StorageConnection {
  id: string;
  ownerId: string;

  provider: StorageProviderType;

  providerAccountId: string | null;
  displayName: string | null;
  rootId: string | null;

  status: StorageConnectionStatus;

  lastVerifiedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export function ownsStorageConnection(
  connection: Pick<StorageConnection, 'ownerId'>,
  userId: string,
): boolean {
  return connection.ownerId === userId;
}
