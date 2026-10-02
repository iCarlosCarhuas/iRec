import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  AlbumAssetContract,
  CreateAlbumAssetInput,
  FinalizeAlbumAssetInput,
  MAX_ALBUM_ASSET_SIZE_BYTES,
  normalizeAlbumAssetMime,
  type CreateAlbumAssetInput as CreateAlbumAssetInputType,
} from '@irec/contracts';

import {
  canCreateAlbumAsset,
  canDeleteAlbumAsset,
  canFinalizeAlbumAsset,
  canTransitionAlbumAssetStatus,
} from '../src/albums/album-assets.policy.js';
import { AlbumAssetsService } from '../src/albums/album-assets.service.js';

// ---------------------------------------------------------------------------
// Contracts: mime/size guards
// ---------------------------------------------------------------------------

test('CreateAlbumAssetInput accepts the image/video allowlist', () => {
  for (
    const mimeType of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ]
  ) {
    const parsed = CreateAlbumAssetInput.parse({
      storageConnectionId: '11111111-1111-4111-8111-111111111111',
      mimeType,
      originalName: 'photo.jpg',
      sizeBytes: 1024,
    });
    assert.equal(parsed.mimeType, mimeType);
  }
});

test('normalizeAlbumAssetMime maps the jpg alias to jpeg', () => {
  assert.equal(normalizeAlbumAssetMime('image/jpg'), 'image/jpeg');
  assert.equal(normalizeAlbumAssetMime('IMAGE/JPG'), 'image/jpeg');
});

test('CreateAlbumAssetInput rejects non-allowlist mime types', () => {
  for (
    const mimeType of [
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      'application/pdf',
      'video/x-msvideo',
      'video/x-matroska',
    ]
  ) {
    assert.equal(
      CreateAlbumAssetInput.safeParse({
        storageConnectionId: '11111111-1111-4111-8111-111111111111',
        mimeType,
        originalName: 'file',
        sizeBytes: 1024,
      }).success,
      false,
    );
  }
});

test('CreateAlbumAssetInput rejects bad sizes and blank names', () => {
  const base = {
    storageConnectionId: '11111111-1111-4111-8111-111111111111',
    mimeType: 'image/jpeg',
    originalName: 'photo.jpg',
  } as const;

  for (const sizeBytes of [0, -1, 1.5, MAX_ALBUM_ASSET_SIZE_BYTES + 1]) {
    assert.equal(
      CreateAlbumAssetInput.safeParse({ ...base, sizeBytes }).success,
      false,
      `size ${sizeBytes} should be rejected`,
    );
  }

  assert.equal(
    CreateAlbumAssetInput.safeParse({ ...base, sizeBytes: 1, originalName: '   ' }).success,
    false,
  );
});

test('FinalizeAlbumAssetInput requires a provider file id', () => {
  assert.equal(FinalizeAlbumAssetInput.safeParse({ providerFileId: '' }).success, false);
  assert.equal(FinalizeAlbumAssetInput.safeParse({}).success, false);
  assert.equal(
    FinalizeAlbumAssetInput.parse({ providerFileId: 'drive-file-id' }).providerFileId,
    'drive-file-id',
  );
});

// ---------------------------------------------------------------------------
// Policy: authz + status transitions
// ---------------------------------------------------------------------------

test('owner and active members may create assets; outsiders may not', () => {
  assert.equal(canCreateAlbumAsset('owner', 'owner', false), true);
  assert.equal(canCreateAlbumAsset('owner', 'member', true), true);
  assert.equal(canCreateAlbumAsset('owner', 'outsider', false), false);
});

test('only owner or active uploader may delete/finalize', () => {
  assert.equal(canDeleteAlbumAsset('owner', 'member', 'owner', false), true);
  assert.equal(canDeleteAlbumAsset('owner', 'member', 'member', true), true);
  assert.equal(canDeleteAlbumAsset('owner', 'member', 'other', true), false);
  assert.equal(canDeleteAlbumAsset('owner', 'member', 'member', false), false);
  assert.equal(canFinalizeAlbumAsset('owner', 'member', 'other', true), false);
  assert.equal(canFinalizeAlbumAsset('owner', 'member', 'member', true), true);
});

test('asset status transitions only move forward', () => {
  assert.equal(canTransitionAlbumAssetStatus('pending', 'ready'), true);
  assert.equal(canTransitionAlbumAssetStatus('pending', 'failed'), true);
  assert.equal(canTransitionAlbumAssetStatus('pending', 'deleted'), true);
  assert.equal(canTransitionAlbumAssetStatus('ready', 'deleted'), true);
  assert.equal(canTransitionAlbumAssetStatus('failed', 'deleted'), true);
  assert.equal(canTransitionAlbumAssetStatus('ready', 'pending'), false);
  assert.equal(canTransitionAlbumAssetStatus('failed', 'ready'), false);
  assert.equal(canTransitionAlbumAssetStatus('ready', 'ready'), false);
  assert.equal(canTransitionAlbumAssetStatus('deleted', 'ready'), false);
  assert.equal(canTransitionAlbumAssetStatus('deleted', 'deleted'), false);
});

// ---------------------------------------------------------------------------
// Service: tenant isolation + guards (mocked db, no provider, no bytes)
// ---------------------------------------------------------------------------

const ALBUM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONNECTION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ASSET_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const albumRow = (overrides = {}) => ({
  id: ALBUM_ID,
  ownerId: OWNER_ID,
  title: 'Trip',
  description: null,
  visibility: 'private',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const connectionRow = (overrides = {}) => ({
  id: CONNECTION_ID,
  ownerId: OWNER_ID,
  provider: 'google_drive',
  providerAccountId: 'account',
  displayName: null,
  rootId: 'root',
  credentialsEncrypted: 'ciphertext',
  status: 'ready',
  lastVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const assetRow = (overrides = {}) => ({
  id: ASSET_ID,
  albumId: ALBUM_ID,
  uploadedBy: OWNER_ID,
  storageConnectionId: CONNECTION_ID,
  provider: 'google_drive',
  providerFileId: null,
  mimeType: 'image/jpeg',
  originalName: 'photo.jpg',
  sizeBytes: 1024,
  status: 'pending',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...overrides,
});

const createInput: CreateAlbumAssetInputType = {
  storageConnectionId: CONNECTION_ID,
  mimeType: 'image/jpeg',
  originalName: 'photo.jpg',
  sizeBytes: 1024,
};

type FakeQueues = { select: unknown[][]; insert: unknown[][]; update: unknown[][] };
type FakeSeen = {
  inserts: number;
  updates: number;
  op: string;
  values: unknown;
  set: unknown;
  predicates: string[];
};

function makeDb(queues: FakeQueues, seen: FakeSeen) {
  const chain: Record<string, (...args: never[]) => unknown> = {
    select: () => chain,
    from: () => chain,
    // Terminal like drizzle: orderBy resolves the queued rows.
    orderBy: (() => queues.select.shift() ?? []) as never,
    where: ((predicate: SQL) => {
      const query = new PgDialect().sqlToQuery(predicate);
      seen.predicates.push(query.sql);
      return chain;
    }) as never,
    insert: () => {
      seen.inserts += 1;
      seen.op = 'insert';
      return chain;
    },
    update: () => {
      seen.updates += 1;
      seen.op = 'update';
      return chain;
    },
    values: ((values: unknown) => {
      seen.values = values;
      return chain;
    }) as never,
    set: ((values: unknown) => {
      seen.set = values;
      return chain;
    }) as never,
    limit: (async () => queues.select.shift() ?? []) as never,
    returning: (async () =>
      seen.op === 'insert' ? (queues.insert.shift() ?? []) : (queues.update.shift() ?? [])) as never,
  };
  return chain;
}

function setup(queues: Partial<FakeQueues>) {
  const seen: FakeSeen = { inserts: 0, updates: 0, op: '', values: undefined, set: undefined, predicates: [] };
  const full: FakeQueues = { select: queues.select ?? [], insert: queues.insert ?? [], update: queues.update ?? [] };
  const service = new AlbumAssetsService({ db: makeDb(full, seen) } as never);
  return { service, seen };
}

test('createPending stores a pending asset with the owned connection', async () => {
  const { service, seen } = setup({
    select: [[albumRow()], [connectionRow()]],
    insert: [[assetRow()]],
  });

  const asset = await service.createPending(ALBUM_ID, OWNER_ID, createInput);

  assert.equal(seen.inserts, 1);
  assert.equal((seen.values as { status: string }).status, 'pending');
  assert.equal((seen.values as { providerFileId: null }).providerFileId, null);
  assert.equal(asset.storageConnectionId, CONNECTION_ID);
  assert.equal(asset.status, 'pending');
  assert.equal(asset.providerFileId, null);
  assert.ok(AlbumAssetContract.safeParse(asset).success);
});

test('createPending never attaches another user connection (404, no insert, no leak)', async () => {
  const { service, seen } = setup({
    select: [[albumRow()], [{ userId: MEMBER_ID }], []],
  });

  await assert.rejects(service.createPending(ALBUM_ID, MEMBER_ID, createInput), NotFoundException);

  // Owner predicate keeps foreign connections indistinguishable from missing.
  const connectionPredicate = seen.predicates[seen.predicates.length - 1] ?? '';
  assert.match(connectionPredicate, /"owner_id"/);
  assert.match(connectionPredicate, /"provider"/);
  assert.equal(seen.inserts, 0);
});

test('createPending rejects non-ready owned connections', async () => {
  const { service, seen } = setup({
    select: [[albumRow()], [connectionRow({ status: 'pending' })]],
  });

  await assert.rejects(service.createPending(ALBUM_ID, OWNER_ID, createInput), ConflictException);
  assert.equal(seen.inserts, 0);
});

test('createPending rejects outsiders of private albums first', async () => {
  const { service, seen } = setup({ select: [[albumRow()], []] });

  await assert.rejects(service.createPending(ALBUM_ID, OUTSIDER_ID, createInput), ForbiddenException);
  assert.equal(seen.inserts, 0);
});

test('listByAlbum filters deleted assets at the query level', async () => {
  const { service, seen } = setup({ select: [[albumRow()], [{ userId: MEMBER_ID }], [assetRow({ status: 'ready' })]] });

  const result = await service.listByAlbum(ALBUM_ID, MEMBER_ID);

  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0]?.storageConnectionId, CONNECTION_ID);
  const assetPredicate = seen.predicates[seen.predicates.length - 1] ?? '';
  assert.match(assetPredicate, /"album_id"/);
  assert.match(assetPredicate, /"status"/);
});

test('listByAlbum hides private albums from outsiders', async () => {
  const { service } = setup({ select: [[albumRow()], []] });

  await assert.rejects(service.listByAlbum(ALBUM_ID, OUTSIDER_ID), NotFoundException);
});

test('finalizeAfterVerify moves pending assets to ready with the file id', async () => {
  const { service, seen } = setup({
    select: [[assetRow()], [albumRow()]],
    update: [[assetRow({ status: 'ready', providerFileId: 'drive-file-id' })]],
  });

  const asset = await service.finalizeAfterVerify(ASSET_ID, OWNER_ID, {
    providerFileId: 'drive-file-id',
  });

  assert.equal(asset.status, 'ready');
  assert.equal(asset.providerFileId, 'drive-file-id');
  assert.equal((seen.set as { status: string }).status, 'ready');
});

test('finalizeAfterVerify rejects non-pending assets', async () => {
  const { service, seen } = setup({
    select: [[assetRow({ status: 'ready', providerFileId: 'file' })], [albumRow()]],
  });

  await assert.rejects(
    service.finalizeAfterVerify(ASSET_ID, OWNER_ID, { providerFileId: 'other' }),
    ConflictException,
  );
  assert.equal(seen.updates, 0);
});

test('requestDelete scopes the asset to its album (cross-album reads 404)', async () => {
  const { service, seen } = setup({ select: [[albumRow()], []] });

  await assert.rejects(service.requestDelete('other-album', ASSET_ID, OWNER_ID), NotFoundException);
  assert.equal(seen.updates, 0);
});

test('requestDelete forbids non-uploader members', async () => {
  const { service, seen } = setup({
    select: [[albumRow()], [assetRow({ uploadedBy: OWNER_ID })], [{ userId: MEMBER_ID }]],
  });

  await assert.rejects(service.requestDelete(ALBUM_ID, ASSET_ID, MEMBER_ID), ForbiddenException);
  assert.equal(seen.updates, 0);
});

test('requestDelete soft-deletes and is idempotent', async () => {
  const first = setup({
    select: [[albumRow()], [assetRow()]],
    update: [[assetRow({ status: 'deleted' })]],
  });
  const result = await first.service.requestDelete(ALBUM_ID, ASSET_ID, OWNER_ID);
  assert.deepEqual(result, { success: true });
  assert.equal((first.seen.set as { status: string }).status, 'deleted');

  const second = setup({ select: [[albumRow()], [assetRow({ status: 'deleted' })]] });
  assert.deepEqual(await second.service.requestDelete(ALBUM_ID, ASSET_ID, OWNER_ID), { success: true });
  assert.equal(second.seen.updates, 0);
});
