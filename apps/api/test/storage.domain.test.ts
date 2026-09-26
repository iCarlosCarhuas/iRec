import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CreateStorageConnectionInput,
  StorageConnectionContract,
} from '@irec/contracts';

import { canManageStorageConnection } from '../src/storage/storage.policy.js';

test('CreateStorageConnectionInput normalizes non-secret identifiers', () => {
  const parsed = CreateStorageConnectionInput.parse({
    accountId: '  account-123  ',
    bucket: '  family-album  ',
    accessKeyId: '  key-id  ',
    secretAccessKey: ' secret-with-spaces ',
  });

  assert.equal(parsed.accountId, 'account-123');
  assert.equal(parsed.bucket, 'family-album');
  assert.equal(parsed.accessKeyId, 'key-id');
  assert.equal(parsed.secretAccessKey, ' secret-with-spaces ');
});

test('StorageConnectionContract never exposes credential fields', () => {
  const parsed = StorageConnectionContract.parse({
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: '22222222-2222-4222-8222-222222222222',
    accountId: 'account-123',
    bucket: 'family-album',
    lastVerifiedAt: '2026-09-25T20:00:00.000Z',
    createdAt: '2026-09-25T20:00:00.000Z',
    updatedAt: '2026-09-25T20:00:00.000Z',
    accessKeyIdEncrypted: 'must-not-leak',
    secretAccessKeyEncrypted: 'must-not-leak',
  });

  assert.equal('accessKeyIdEncrypted' in parsed, false);
  assert.equal('secretAccessKeyEncrypted' in parsed, false);
});

test('only the owner may manage a storage connection', () => {
  assert.equal(canManageStorageConnection('owner', 'owner'), true);
  assert.equal(canManageStorageConnection('owner', 'other'), false);
});
