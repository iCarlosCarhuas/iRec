import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { storageConnections } from '../src/database/schema.js';
import { StorageConnectionService } from '../src/storage/storage-connection.service.js';

const row = {
  id: 'connection', ownerId: 'owner', provider: 'google_drive', providerAccountId: 'account',
  displayName: null, rootId: 'known-root', status: 'ready', credentialsEncrypted: 'test-ciphertext',
  lastVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
};

function assertOwnerPredicate(predicate: SQL, provider = false) {
  const query = new PgDialect().sqlToQuery(predicate);
  assert.deepEqual(query.params, provider ? ['connection', 'owner', 'google_drive'] : ['connection', 'owner']);
  assert.match(query.sql, /"id"/);
  assert.match(query.sql, /"owner_id"/);
  if (provider) assert.match(query.sql, /"provider"/);
}

test('same-account reconnect preserves root, refreshes encrypted credentials and requires revalidation', async () => {
  let inserted: Record<string, unknown> = {};
  let conflict: { target: unknown[]; set: Record<string, unknown> };
  const db = {
    insert() { return this; },
    values(values: Record<string, unknown>) { inserted = values; return this; },
    onConflictDoUpdate(input: typeof conflict) { conflict = input; return this; },
    async returning() {
      assert.deepEqual(conflict.target, [storageConnections.ownerId, storageConnections.provider, storageConnections.providerAccountId]);
      assert.equal(conflict.set.rootId, storageConnections.rootId);
      assert.equal(conflict.set.status, 'pending');
      assert.equal(conflict.set.lastVerifiedAt, null);
      assert.equal(conflict.set.credentialsEncrypted, 'refreshed-test-ciphertext');
      return [{ ...row, ...conflict.set, rootId: row.rootId }];
    },
  };
  const service = new StorageConnectionService({ db } as never, {
    encrypt(envelope: string) { assert.equal(envelope, 'test-envelope'); return 'refreshed-test-ciphertext'; },
  } as never);
  const result = await service.upsert('owner', {
    provider: 'google_drive', providerAccountId: 'account', rootId: null, credentialEnvelope: 'test-envelope',
  });
  assert.equal(inserted.rootId, null);
  assert.equal(result.rootId, 'known-root');
  assert.equal(result.status, 'pending');
  assert.equal(result.lastVerifiedAt, null);
  assert.equal('credentialsEncrypted' in result, false);
});

test('credential reads decrypt only owner-scoped rows', async () => {
  let found = true;
  let decrypts = 0;
  const db = {
    select() { return this; }, from() { return this; },
    where(predicate: SQL) { assertOwnerPredicate(predicate); return this; },
    async limit() { return found ? [row] : []; },
  };
  const service = new StorageConnectionService({ db } as never, {
    decrypt() { decrypts++; return 'test-envelope'; },
  } as never);
  assert.equal(await service.getCredentialEnvelope('connection', 'owner'), 'test-envelope');
  found = false;
  assert.equal(await service.getCredentialEnvelope('connection', 'owner'), null);
  assert.equal(decrypts, 1);
});

test('root preparation locks an owner/provider row and atomically persists ready metadata', async () => {
  let lockHeld = false;
  let update: Record<string, unknown> = {};
  let predicate: SQL | undefined;
  const tx = {
    select() { return this; }, from() { return this; }, limit() { return this; },
    where(value: SQL) { assertOwnerPredicate(value, true); predicate = value; return this; },
    async for(mode: string) { assert.equal(mode, 'update'); lockHeld = true; return [row]; },
    update() { assert.ok(lockHeld); return this; },
    set(value: Record<string, unknown>) { update = value; return this; },
    async returning() { return [{ ...row, ...update }]; },
  };
  const db = {
    async transaction(operation: (value: typeof tx) => Promise<unknown>) {
      try { return await operation(tx); } finally { lockHeld = false; }
    },
  };
  const service = new StorageConnectionService({ db } as never, { decrypt: () => 'test-envelope' } as never);
  const result = await service.prepareGoogleDriveRoot('connection', 'owner', async (connection, envelope) => {
    assert.ok(lockHeld);
    assert.equal(connection.rootId, 'known-root');
    assert.equal('credentialsEncrypted' in connection, false);
    assert.equal(envelope, 'test-envelope');
    return 'verified-root';
  });
  assert.ok(predicate);
  assert.equal(update.rootId, 'verified-root');
  assert.equal(update.status, 'ready');
  assert.ok(update.lastVerifiedAt instanceof Date);
  assert.equal(update.updatedAt, update.lastVerifiedAt);
  assert.equal('credentialsEncrypted' in update, false);
  assert.equal(result?.rootId, 'verified-root');
  assert.equal(lockHeld, false);
});
