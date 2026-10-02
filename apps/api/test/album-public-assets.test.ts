import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  AlbumAssetsResponseSchema,
  AlbumAssetContract,
} from '@irec/contracts';

import { AlbumAssetsService } from '../src/albums/album-assets.service.js';
import { AlbumAssetContentService } from '../src/albums/album-asset-content.service.js';
import { AlbumPublicAssetsController } from '../src/albums/album-public-assets.controller.js';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PUBLIC_ALBUM = 'a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5';
const PRIVATE_ALBUM = 'a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const APPROVED_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const INVITED_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONN_A = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';
const ASSET_READY = 'f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f8f8';
const ASSET_PENDING = 'f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f9f9';
const VERIFIED_AT = new Date('2026-01-01T00:00:00.000Z');

const albumRow = (overrides = {}) => ({
  id: PUBLIC_ALBUM,
  ownerId: OWNER_ID,
  title: 'Trip',
  description: null,
  visibility: 'public',
  createdAt: VERIFIED_AT,
  updatedAt: VERIFIED_AT,
  ...overrides,
});

const assetRow = (overrides = {}) => ({
  id: ASSET_READY,
  albumId: PUBLIC_ALBUM,
  uploadedBy: OWNER_ID,
  storageConnectionId: CONN_A,
  provider: 'google_drive',
  providerFileId: 'drive-file-a',
  mimeType: 'image/jpeg',
  originalName: 'photo.jpg',
  sizeBytes: 1024,
  status: 'ready',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...overrides,
});

function assertNoSecrets(value: unknown): void {
  assert.doesNotMatch(
    JSON.stringify(value),
    /refresh[-_ ]?token|access[-_ ]?token|fixture-access|Bearer ey|test-session|invalid_grant|qr|invite[-_ ]?token/i,
  );
}

async function rejectsStatus(operation: () => Promise<unknown>, status: number) {
  try {
    await operation();
  } catch (error) {
    const assertModule = await import('node:assert/strict');
    assertModule.default.ok(error instanceof Error);
    const statusOf = (error as { getStatus?: () => number }).getStatus?.();
    assertModule.default.equal(statusOf, status);
    return error;
  }
  assert.fail(`expected HTTP ${status}`);
}

type FakeQueues = { select: unknown[][]; insert: unknown[][]; update: unknown[][] };
type FakeSeen = { predicates: string[]; op: string; values: unknown; set: unknown };

function makeDb(queues: FakeQueues, seen: FakeSeen) {
  const chain: Record<string, (...args: never[]) => unknown> = {
    select: () => chain,
    from: () => chain,
    orderBy: (() => queues.select.shift() ?? []) as never,
    where: ((predicate: SQL) => {
      const query = new PgDialect().sqlToQuery(predicate);
      seen.predicates.push(query.sql);
      return chain;
    }) as never,
    insert: () => chain,
    update: () => chain,
    values: ((values: unknown) => {
      seen.values = values;
      return chain;
    }) as never,
    set: ((values: unknown) => {
      seen.set = values;
      return chain;
    }) as never,
    limit: (async () => queues.select.shift() ?? []) as never,
    returning: (async () => []) as never,
  };
  return chain;
}

function setup(queues: Partial<FakeQueues>) {
  const seen: FakeSeen = { predicates: [], op: '', values: undefined, set: undefined };
  const full: FakeQueues = {
    select: queues.select ?? [],
    insert: queues.insert ?? [],
    update: queues.update ?? [],
  };
  return { service: new AlbumAssetsService({ db: makeDb(full, seen) } as never), seen };
}

// ---------------------------------------------------------------------------
// Service: public list
// ---------------------------------------------------------------------------

test('public list serves ready assets anonymously for public albums', async () => {
  const { service } = setup({
    select: [
      [albumRow()],
      [
        assetRow(),
        assetRow({ id: ASSET_PENDING, status: 'pending', providerFileId: null }),
      ],
    ],
  });

  const result = await service.listPublicAssets(PUBLIC_ALBUM);
  assert.deepEqual(AlbumAssetsResponseSchema.parse(result), result);
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0]?.id, ASSET_READY);
  assert.equal(result.assets[0]?.storageConnectionId, CONN_A);
  assert.equal(result.assets[0]?.providerFileId, 'drive-file-a');
  assertNoSecrets(result);
});

test('public list 404s private albums (possession is not authorization)', async () => {
  const { service } = setup({
    select: [[albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })]],
  });

  await rejectsStatus(() => service.listPublicAssets(PRIVATE_ALBUM), 404);
});

test('public single asset: ready 200, pending 404, private 404', async () => {
  const ready = setup({
    select: [[albumRow()], [assetRow()]],
  });
  const asset = await ready.service.getPublicAsset(PUBLIC_ALBUM, ASSET_READY);
  assert.ok(AlbumAssetContract.safeParse(asset).success);
  assertNoSecrets(asset);

  const pending = setup({
    select: [[albumRow()], [assetRow({ status: 'pending', providerFileId: null })]],
  });
  await rejectsStatus(() => pending.service.getPublicAsset(PUBLIC_ALBUM, ASSET_PENDING), 404);

  const stocked = setup({
    select: [[albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })]],
  });
  await rejectsStatus(() => stocked.service.getPublicAsset(PRIVATE_ALBUM, ASSET_READY), 404);
});

// ---------------------------------------------------------------------------
// Service: private list with member / approved-proposal / pending rules
// ---------------------------------------------------------------------------

test('private list: owner sees pending+ready, member sees only ready', async () => {
  const rows = [
    assetRow(),
    assetRow({ id: ASSET_PENDING, status: 'pending', providerFileId: null }),
  ];

  const ownerSetup = setup({ select: [[albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })], rows] });
  const ownerResult = await ownerSetup.service.listByAlbum(PRIVATE_ALBUM, OWNER_ID);
  assert.equal(ownerResult.assets.length, 2);

  const memberSetup = setup({
    select: [
      [albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })],
      [{ userId: MEMBER_ID }],
      rows,
    ],
  });
  const memberResult = await memberSetup.service.listByAlbum(PRIVATE_ALBUM, MEMBER_ID);
  assert.equal(memberResult.assets.length, 1);
  assert.equal(memberResult.assets[0]?.status, 'ready');
  assertNoSecrets(memberResult);
});

test('private list: approved proposal viewer reads ready (200)', async () => {
  const { service } = setup({
    select: [
      [albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })],
      [],
      [{ id: 'proposal-id' }],
      [assetRow({ albumId: PRIVATE_ALBUM })],
    ],
  });

  const result = await service.listByAlbum(PRIVATE_ALBUM, APPROVED_ID);
  assert.equal(result.assets.length, 1);
  assertNoSecrets(result);
});

test('private list: invited-but-not-accepted and QR-only outsiders stay 404', async () => {
  for (const viewer of [INVITED_ID, OUTSIDER_ID, undefined]) {
    const { service } = setup({
      select: [
        [albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })],
        ...(viewer ? [[], []] : []),
      ],
    });
    await rejectsStatus(() => service.listByAlbum(PRIVATE_ALBUM, viewer), 404);
  }
});

test('private meta: pending hidden from non-owners (404), visible to owner', async () => {
  const ownerSetup = setup({
    select: [
      [albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })],
      [assetRow({ albumId: PRIVATE_ALBUM, status: 'pending', providerFileId: null })],
    ],
  });
  const meta = await ownerSetup.service.getOne(PRIVATE_ALBUM, ASSET_PENDING, OWNER_ID);
  assert.equal(meta.status, 'pending');

  const memberSetup = setup({
    select: [
      [albumRow({ id: PRIVATE_ALBUM, visibility: 'private' })],
      [{ userId: MEMBER_ID }],
      [assetRow({ albumId: PRIVATE_ALBUM, status: 'pending', providerFileId: null })],
    ],
  });
  await rejectsStatus(() => memberSetup.service.getOne(PRIVATE_ALBUM, ASSET_PENDING, MEMBER_ID), 404);
});

// ---------------------------------------------------------------------------
// HTTP: public controller (mocked services, real validation + filter)
// ---------------------------------------------------------------------------

Reflect.defineMetadata(
  'design:paramtypes',
  [AlbumAssetsService, AlbumAssetContentService],
  AlbumPublicAssetsController,
);

test('public HTTP: anonymous 200 for public, 404 for private, 422 for bad UUID', async (t) => {
  const readyAsset = {
    id: ASSET_READY,
    albumId: PUBLIC_ALBUM,
    uploadedBy: OWNER_ID,
    storageConnectionId: CONN_A,
    provider: 'google_drive',
    providerFileId: 'drive-file-a',
    mimeType: 'image/jpeg',
    originalName: 'photo.jpg',
    sizeBytes: 4,
    status: 'ready',
    createdAt: VERIFIED_AT.toISOString(),
    updatedAt: VERIFIED_AT.toISOString(),
  };
  const { NotFoundException: NotFound } = await import('@nestjs/common');
  const assets = {
    async listPublicAssets(albumId: string) {
      if (albumId === PRIVATE_ALBUM) {
        throw new NotFound({
          type: 'https://irec.app/problems/album-not-found',
          title: 'Album not found',
          status: 404,
          detail: 'El album no existe o no esta disponible para esta sesion.',
        });
      }
      return { assets: [readyAsset] };
    },
    async getPublicAsset() {
      return readyAsset;
    },
  };
  const bytes = Buffer.from([1, 2, 3, 4]);
  const content = {
    async streamPublicContent(albumId: string, assetId: string, range: string | undefined) {
      if (albumId === PRIVATE_ALBUM) {
        throw new NotFound({
          type: 'https://irec.app/problems/album-not-found',
          title: 'Album not found',
          status: 404,
          detail: 'El album no existe o no esta disponible para esta sesion.',
        });
      }
      assert.equal(assetId, ASSET_READY);
      assert.equal(range, undefined);
      return {
        status: 200 as const,
        mimeType: 'image/jpeg',
        contentLength: bytes.length,
        contentRange: null,
        totalLength: bytes.length,
        fileName: 'photo.jpg',
        body: Readable.from([bytes]),
      };
    },
  };

  @Module({
    controllers: [AlbumPublicAssetsController],
    providers: [
      { provide: AlbumAssetsService, useValue: assets },
      { provide: AlbumAssetContentService, useValue: content },
    ],
  })
  class TestModule {}
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  try {
    await t.test('GET public-assets anonymous 200 with connection+file ids, no tokens', async () => {
      const response = await fetch(`${base}/api/albums/${PUBLIC_ALBUM}/public-assets`);
      assert.equal(response.status, 200);
      const value = await response.json();
      assert.deepEqual(AlbumAssetsResponseSchema.parse(value), value);
      assert.equal(value.assets[0]?.storageConnectionId, CONN_A);
      assert.equal(value.assets[0]?.providerFileId, 'drive-file-a');
      assert.doesNotMatch(JSON.stringify(value), /accessToken|refreshToken|Bearer|@.*\./);
    });

    await t.test('GET public-assets 404s private albums without revealing them', async () => {
      const response = await fetch(`${base}/api/albums/${PRIVATE_ALBUM}/public-assets`);
      assert.equal(response.status, 404);
    });

    await t.test('GET public content streams bytes anonymously with inline headers', async () => {
      const response = await fetch(
        `${base}/api/albums/${PUBLIC_ALBUM}/public-assets/${ASSET_READY}/content`,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/jpeg');
      assert.equal(response.headers.get('accept-ranges'), 'bytes');
      assert.match(response.headers.get('content-disposition') ?? '', /inline; filename="photo\.jpg"/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    });

    await t.test('GET public content 404s private albums (QR possession is not auth)', async () => {
      const response = await fetch(
        `${base}/api/albums/${PRIVATE_ALBUM}/public-assets/${ASSET_READY}/content`,
      );
      assert.equal(response.status, 404);
    });

    await t.test('invalid UUIDs fail validation before any service', async () => {
      const badList = await fetch(`${base}/api/albums/not-a-uuid/public-assets`);
      assert.equal(badList.status, 422);
      const badContent = await fetch(
        `${base}/api/albums/${PUBLIC_ALBUM}/public-assets/not-a-uuid/content`,
      );
      assert.equal(badContent.status, 422);
    });
  } finally {
    await app.close();
  }
});
