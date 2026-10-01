export type StorageProviderType = 'google_drive';

export type StorageConnectionStatus =
  | 'pending'
  | 'ready'
  | 'error'
  | 'revoked';

export interface PrepareUploadInput {
  ownerId: string;
  connectionId: string;
  albumId: string;
  assetId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PreparedUpload {
  provider: StorageProviderType;
  uploadUrl: string;
  expiresAt: Date | null;
  providerObjectId?: string;
  metadata?: Record<string, unknown>;
}

export interface VerifyUploadInput {
  ownerId: string;
  connectionId: string;
  albumId: string;
  assetId: string;
  providerObjectId: string;
  expectedMimeType: string;
  expectedSizeBytes: number;
}

export interface VerifiedObject {
  providerObjectId: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  createdAt?: Date;
}

export interface GetAssetInput {
  ownerId: string;
  connectionId: string;
  providerObjectId: string;
}

export interface StoredAsset {
  providerObjectId: string;
  mimeType: string;
  sizeBytes: number;
  name?: string;
}

export interface DeleteAssetInput {
  ownerId: string;
  connectionId: string;
  providerObjectId: string;
}

export interface StorageUsage {
  usedBytes: number | null;
  limitBytes: number | null;
  availableBytes: number | null;
}

export interface UserStorageProvider {
  readonly type: StorageProviderType;

  prepareUpload(input: PrepareUploadInput): Promise<PreparedUpload>;

  verifyUpload(input: VerifyUploadInput): Promise<VerifiedObject>;

  getAsset(input: GetAssetInput): Promise<StoredAsset>;

  deleteAsset(input: DeleteAssetInput): Promise<void>;

  getUsage(connectionId: string, ownerId: string): Promise<StorageUsage>;
}
