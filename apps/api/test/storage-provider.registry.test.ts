import assert from 'node:assert/strict';
import test from 'node:test';

import { StorageProviderRegistry } from '../src/storage/storage-provider.registry.js';

import type {
  DeleteAssetInput,
  GetAssetInput,
  PrepareUploadInput,
  StorageUsage,
  StoredAsset,
  UserStorageProvider,
  VerifiedObject,
  VerifyUploadInput,
} from '../src/storage/storage-provider.js';

const provider: UserStorageProvider = {
  type: 'google_drive',

  async prepareUpload(_input: PrepareUploadInput) {
    return {
      provider: 'google_drive',
      uploadUrl: 'https://example.invalid/upload',
      expiresAt: null,
    };
  },

  async verifyUpload(_input: VerifyUploadInput): Promise<VerifiedObject> {
    return {
      providerObjectId: 'object-1',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    };
  },

  async getAsset(_input: GetAssetInput): Promise<StoredAsset> {
    return {
      providerObjectId: 'object-1',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    };
  },

  async deleteAsset(_input: DeleteAssetInput): Promise<void> {},

  async getUsage(): Promise<StorageUsage> {
    return {
      usedBytes: 0,
      limitBytes: null,
      availableBytes: null,
    };
  },
};

test('registry returns registered storage provider', () => {
  const registry = new StorageProviderRegistry();

  registry.register(provider);

  assert.equal(registry.has('google_drive'), true);
  assert.equal(registry.get('google_drive'), provider);
});

test('registry rejects duplicate provider registration', () => {
  const registry = new StorageProviderRegistry();

  registry.register(provider);

  assert.throws(
    () => registry.register(provider),
    /already registered/,
  );
});

test('registry rejects unavailable provider', () => {
  const registry = new StorageProviderRegistry();

  assert.throws(
    () => registry.get('google_drive'),
    /unavailable/,
  );
});
