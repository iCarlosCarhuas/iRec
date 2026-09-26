import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CreateStorageConnectionInput,
  StorageConnectionContract,
} from '@irec/contracts';

import { canManageStorageConnection } from '../src/storage/storage.policy.js';

const accountId = '0123456789abcdef0123456789abcdef';

test('CreateStorageConnectionInput normalizes valid R2 identifiers', () => {
  const parsed = CreateStorageConnectionInput.parse({
    accountId: `  ${accountId.toUpperCase()}  `,
    bucket: '  family-album  ',
    accessKeyId: '  key-id  ',
    secretAccessKey: ' secret-with-spaces ',
  });

  assert.equal(parsed.accountId, accountId.toUpperCase());
  assert.equal(parsed.bucket, 'family-album');
  assert.equal(parsed.accessKeyId, 'key-id');
  assert.equal(parsed.secretAccessKey, ' secret-with-spaces ');
});

test('CreateStorageConnectionInput rejects unsafe account and bucket values', () => {
  assert.equal(
    CreateStorageConnectionInput.safeParse({
      accountId: 'example.com',
      bucket: 'family-album',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    }).success,
    false,
  );

  assert.equal(
    CreateStorageConnectionInput.safeParse({
      accountId,
      bucket: 'Family_Album',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    }).success,
    false,
  );
});

test('StorageConnectionContract never exposes credential fields', () => {
  const parsed = StorageConnectionContract.parse({
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: '22222222-2222-4222-8222-222222222222',
    accountId,
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
