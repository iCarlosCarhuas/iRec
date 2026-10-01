import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ownsStorageConnection,
  type StorageConnection,
} from '../src/storage/storage-connection.js';

const connection: StorageConnection = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

  provider: 'google_drive',

  providerAccountId: 'google-account-123',
  displayName: 'Cuenta Google',
  rootId: null,

  status: 'pending',

  lastVerifiedAt: null,

  createdAt: new Date('2026-09-30T00:00:00Z'),
  updatedAt: new Date('2026-09-30T00:00:00Z'),
};

test('storage connection belongs to its owner', () => {
  assert.equal(
    ownsStorageConnection(
      connection,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ),
    true,
  );
});

test('storage connection rejects another tenant', () => {
  assert.equal(
    ownsStorageConnection(
      connection,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ),
    false,
  );
});
