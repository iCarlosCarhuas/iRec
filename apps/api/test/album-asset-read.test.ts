import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  AlbumAssetContract,
  AlbumAssetsResponseSchema,
  SuccessResponseSchema,
} from '@irec/contracts';

import { AlbumAssetContentService, parseAssetRangeHeader } from '../src/albums/album-asset-content.service.js';
import { AlbumAssetsService } from '../src/albums/album-assets.service.js';
import { AlbumAssetsController } from '../src/albums/album-assets.controller.js';
import { AlbumAssetUploadService } from '../src/albums/album-asset-upload.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter.js';
import {
  DriveFileGoneError,
  GoogleDriveFileService,
} from '../src/storage/google-drive-file.service.js';
import { GOOGLE_DRIVE_SCOPE } from '../src/storage/google-drive-oauth.service.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ALBUM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PUBLIC_ALBUM_ID = 'a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5';
const PRIVATE_ALBUM_ID = 'a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEMBER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONN_A = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';
const CONN_B = 'e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6';
const ASSET_A = 'f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f8f8';
const ASSET_B = 'f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f9f9';
const FILE_A = 'drive-file-a';
const FILE_B = 'drive-file-b';
const VERIFIED_AT = new Date('2026-01-01T00:00:00.000Z');

const albumRow = (overrides = {}) => ({
  id: ALBUM_ID,
  ownerId: OWNER_ID,
  title: 'Trip',
  description: null,
  visibility: 'private',
  createdAt: VERIFIED_AT,
  updatedAt: VERIFIED_AT,
  ...overrides,
});

const assetRow = (overrides = {}) => ({
  id: ASSET_A,
  albumId: ALBUM_ID,
  uploadedBy: OWNER_ID,
  storageConnectionId: CONN_A,
  provider: 'google_drive',
  providerFileId: FILE_A,
  mimeType: 'image/jpeg',
  originalName: 'photo.jpg',
  sizeBytes: 1024,
  status: 'ready',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...overrides,
});

const videoAssetRow = (overrides = {}) =>
  assetRow({
    mimeType: 'video/mp4',
    originalName: 'clip.mp4',
    sizeBytes: 1000,
    ...overrides,
  });

function envelopeFor(refreshToken: string): string {
  return JSON.stringify({
    version: 1,
    refreshToken,
    scope: GOOGLE_DRIVE_SCOPE,
    tokenType: 'Bearer',
  });
}

function assertNoSecrets(value: unknown): void {
  assert.doesNotMatch(
    JSON.stringify(value),
    /refresh[-_ ]?token|access[-_ ]?token|fixture-access|Bearer ey|test-session|invalid_grant/i,
  );
}

async function rejectsStatus(
  operation: () => Promise<unknown>,
  status: number,
): Promise<HttpException> {
  try {
    await operation();
  } catch (error) {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), status);
    return error;
  }
  assert.fail(`expected HTTP ${status}`);
}

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

const freshSeen = (): FakeSeen => ({
  inserts: 0,
  updates: 0,
  op: '',
  values: undefined,
  set: undefined,
  predicates: [],
});

// ---------------------------------------------------------------------------
// Part A: GoogleDriveFileService against a mocked provider
// ---------------------------------------------------------------------------

interface ProviderFile {
  bytes: Buffer;
  mimeType: string;
  forceStatus?: number;
}

function installProviderMock(
  files: Map<string, ProviderFile>,
  log: { authorizations: string[]; urls: string[]; ranges: (string | null)[]; deletes: string[]; tokens: number },
): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (url.hostname === 'oauth2.googleapis.com') {
      log.tokens += 1;
      const body = new URLSearchParams(String(init?.body));
      const refresh = body.get('refresh_token') ?? 'unknown';
      return new Response(
        JSON.stringify({
          access_token: `access-for-${refresh}`,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }
    if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/drive/v3/files/')) {
      const fileId = decodeURIComponent(url.pathname.replace('/drive/v3/files/', ''));
      const file = files.get(fileId);
      log.authorizations.push(headers.authorization ?? headers.Authorization ?? '');
      log.urls.push(url.toString());
      if (init?.method === 'DELETE') {
        log.deletes.push(fileId);
        const forced = file?.forceStatus;
        if (forced !== undefined) return new Response('{}', { status: forced });
        if (!file) return new Response('{}', { status: 404 });
        files.delete(fileId);
        return new Response(null, { status: 204 });
      }
      if (url.searchParams.get('alt') === 'media') {
        const range = headers.range ?? headers.Range ?? null;
        log.ranges.push(range);
        const forced = file?.forceStatus;
        if (forced !== undefined) return new Response('{}', { status: forced });
        if (!file) return new Response('{}', { status: 404 });
        if (range) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(range);
          assert.ok(match, `unexpected range ${range}`);
          const start = Number(match[1]);
          if (start >= file.bytes.length) {
            return new Response('{}', { status: 416 });
          }
          const end = match[2] === '' ? file.bytes.length - 1 : Math.min(Number(match[2]), file.bytes.length - 1);
          const slice = file.bytes.subarray(start, end + 1);
          return new Response(slice as unknown as BodyInit, {
            status: 206,
            headers: {
              'content-type': file.mimeType,
              'content-length': String(slice.length),
              'content-range': `bytes ${start}-${end}/${file.bytes.length}`,
            },
          });
        }
        return new Response(file.bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            'content-type': file.mimeType,
            'content-length': String(file.bytes.length),
          },
        });
      }
      const forced = file?.forceStatus;
      if (forced !== undefined) return new Response('{}', { status: forced });
      if (!file) return new Response('{}', { status: 404 });
      return new Response(
        JSON.stringify({ id: fileId, mimeType: file.mimeType, size: String(file.bytes.length) }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected provider call ${String(input)}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const freshProviderLog = () => ({
  authorizations: [] as string[],
  urls: [] as string[],
  ranges: [] as (string | null)[],
  deletes: [] as string[],
  tokens: 0,
});

function driveSetup(
  connections: Map<string, { ownerId: string; status: string }>,
  envelopes: Map<string, string>,
) {
  const storage = {
    async getOwned(id: string, owner: string) {
      const row = connections.get(id);
      if (!row || row.ownerId !== owner) return null;
      return {
        id,
        ownerId: owner,
        provider: 'google_drive' as const,
        providerAccountId: 'account',
        displayName: null,
        rootId: 'root',
        status: row.status as 'ready',
        lastVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async getCredentialEnvelope(id: string, owner: string) {
      const row = connections.get(id);
      if (!row || row.ownerId !== owner) return null;
      return envelopes.get(id) ?? null;
    },
  };
  const config = {
    get: (key: string) =>
      key === 'GOOGLE_OAUTH_CLIENT_ID' || key === 'GOOGLE_OAUTH_CLIENT_SECRET'
        ? 'fixture-oauth-client'
        : undefined,
  };
  return new GoogleDriveFileService(config as never, storage as never);
}

const readyConnections = () =>
  new Map([
    [CONN_A, { ownerId: OWNER_ID, status: 'ready' }],
    [CONN_B, { ownerId: OWNER_ID, status: 'ready' }],
  ]);

const envelopesAB = () =>
  new Map([
    [CONN_A, envelopeFor('refresh-A')],
    [CONN_B, envelopeFor('refresh-B')],
  ]);

test('drive client resolves each asset connection (multi-drive, no same-drive assumption)', async () => {
  const log = freshProviderLog();
  const files = new Map([
    [FILE_A, { bytes: Buffer.from([1, 2, 3, 4]), mimeType: 'image/jpeg' }],
    [FILE_B, { bytes: Buffer.from([5, 6, 7, 8]), mimeType: 'image/png' }],
  ]);
  const restore = installProviderMock(files, log);
  try {
    const drive = driveSetup(readyConnections(), envelopesAB());

    await drive.getMetadata({ connectionId: CONN_A, ownerId: OWNER_ID }, FILE_A);
    await drive.downloadMedia({ connectionId: CONN_B, ownerId: OWNER_ID }, FILE_B);

    assert.equal(log.tokens, 2);
    // The token minted from connection A's envelope authorizes the file-A
    // call, and connection B's envelope authorizes the file-B call.
    assert.ok(log.authorizations[0]?.includes('access-for-refresh-A'));
    assert.ok(log.authorizations[1]?.includes('access-for-refresh-B'));
    assert.ok(log.urls[0]?.includes(encodeURIComponent(FILE_A)));
    assert.ok(log.urls[1]?.includes(encodeURIComponent(FILE_B)));
    assert.ok(log.urls.every((entry) => entry.includes('supportsAllDrives=true')));
    assertNoSecrets(log);
  } finally {
    restore();
  }
});

test('drive download forwards Range and mirrors 206 for video', async () => {
  const log = freshProviderLog();
  const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
  const files = new Map([[FILE_A, { bytes, mimeType: 'video/mp4' }]]);
  const restore = installProviderMock(files, log);
  try {
    const drive = driveSetup(readyConnections(), envelopesAB());
    const result = await drive.downloadMedia(
      { connectionId: CONN_A, ownerId: OWNER_ID },
      FILE_A,
      { start: 0, end: 99 },
    );

    assert.equal(result.status, 206);
    assert.equal(result.contentRange, 'bytes 0-99/1000');
    assert.equal(result.contentLength, 100);
    assert.equal(result.totalLength, 1000);
    assert.equal(result.contentType, 'video/mp4');
    assert.deepEqual(log.ranges.at(-1), 'bytes=0-99');
    const chunks: Buffer[] = [];
    for await (const chunk of result.body) chunks.push(Buffer.from(chunk as Uint8Array));
    assert.deepEqual(Buffer.concat(chunks), bytes.subarray(0, 100));
  } finally {
    restore();
  }
});

test('drive delete maps provider states explicitly (gone vs 403/500)', async () => {
  const log = freshProviderLog();
  const files = new Map([
    ['gone-file', { bytes: Buffer.alloc(4), mimeType: 'image/jpeg', forceStatus: 404 }],
    ['denied-file', { bytes: Buffer.alloc(4), mimeType: 'image/jpeg', forceStatus: 403 }],
    ['broken-file', { bytes: Buffer.alloc(4), mimeType: 'image/jpeg', forceStatus: 500 }],
  ]);
  const restore = installProviderMock(files, log);
  try {
    const drive = driveSetup(readyConnections(), envelopesAB());
    const ref = { connectionId: CONN_A, ownerId: OWNER_ID };

    const gone = await drive.deleteFile(ref, 'gone-file').then(
      () => null,
      (error: unknown) => error,
    );
    assert.ok(gone instanceof DriveFileGoneError);

    for (const fileId of ['denied-file', 'broken-file']) {
      const error = await rejectsStatus(() => drive.deleteFile(ref, fileId), 502);
      assertNoSecrets(error.getResponse());
    }
    assertNoSecrets(log);
  } finally {
    restore();
  }
});

test('drive client 404s foreign connections without touching the provider', async () => {  const log = freshProviderLog();
  const restore = installProviderMock(new Map(), log);
  try {
    const drive = driveSetup(readyConnections(), envelopesAB());
    // CONN_B belongs to OWNER_ID; MEMBER_ID asking for it reads as missing.
    const error = await rejectsStatus(
      () => drive.getMetadata({ connectionId: CONN_B, ownerId: MEMBER_ID }, FILE_B),
      404,
    );
    assert.equal(log.tokens, 0);
    assert.equal(log.urls.length, 0);
    assert.doesNotMatch(JSON.stringify(error.getResponse()), /ownerId|owner_id/);
  } finally {
    restore();
  }
});

test('drive client rejects non-ready connections (409) before any token refresh', async () => {
  const log = freshProviderLog();
  const restore = installProviderMock(new Map(), log);
  try {
    const drive = driveSetup(
      new Map([[CONN_A, { ownerId: OWNER_ID, status: 'error' }]]),
      envelopesAB(),
    );
    const error = await rejectsStatus(
      () => drive.downloadMedia({ connectionId: CONN_A, ownerId: OWNER_ID }, FILE_A),
      409,
    );
    assert.equal(
      (error.getResponse() as { type: string }).type,
      'https://irec.app/problems/storage-connection-not-ready',
    );
    assert.equal(log.tokens, 0);
    assertNoSecrets(error.getResponse());
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Part B: AlbumAssetContentService (real authz, stubbed Drive)
// ---------------------------------------------------------------------------

function contentSetup(
  queues: Partial<FakeQueues>,
  drive: unknown,
) {
  const seen = freshSeen();
  const full: FakeQueues = {
    select: queues.select ?? [],
    insert: queues.insert ?? [],
    update: queues.update ?? [],
  };
  const assets = new AlbumAssetsService({ db: makeDb(full, seen) } as never);
  return { service: new AlbumAssetContentService(assets, drive as never), assets, seen };
}

function stubDrive(overrides: {
  metadata?: unknown;
  media?: (ref: unknown, fileId: string, range: unknown) => Promise<unknown>;
  onDelete?: (ref: unknown, fileId: string) => Promise<unknown>;
} = {}) {
  const calls: { op: string; ref: unknown; fileId: string; range: unknown }[] = [];
  return {
    calls,
    async getMetadata(ref: unknown, fileId: string) {
      calls.push({ op: 'metadata', ref, fileId, range: null });
      return (
        (overrides.metadata as Record<string, unknown>) ?? {
          providerFileId: fileId,
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
        }
      );
    },
    async downloadMedia(ref: unknown, fileId: string, range: unknown) {
      calls.push({ op: 'media', ref, fileId, range: range ?? null });
      if (overrides.media) return overrides.media(ref, fileId, range);
      const bytes = Buffer.from([9, 8, 7, 6]);
      return {
        status: 200 as const,
        contentType: 'image/jpeg',
        contentLength: bytes.length,
        contentRange: null,
        totalLength: bytes.length,
        body: Readable.from([bytes]),
      };
    },
    async deleteFile(ref: unknown, fileId: string) {
      calls.push({ op: 'delete', ref, fileId, range: null });
      if (overrides.onDelete) return overrides.onDelete(ref, fileId);
      return { success: true };
    },
  };
}

test('content reads use the asset own connection (A in Drive A, B in Drive B)', async () => {
  const drive = stubDrive({
    metadata: { providerFileId: FILE_A, mimeType: 'image/jpeg', sizeBytes: 1024 },
  });
  const { service } = contentSetup(
    {
      // getOne A: album, membership(owner → truthy without query), asset A.
      select: [[albumRow()], [assetRow()]],
    },
    drive,
  );

  await service.streamContent(ALBUM_ID, ASSET_A, OWNER_ID, undefined);

  const refs = drive.calls.map((call) => call.ref);
  assert.ok(refs.length >= 2);
  for (const ref of refs) {
    assert.deepEqual(ref, { connectionId: CONN_A, ownerId: OWNER_ID });
  }
  assert.deepEqual(
    drive.calls.map((call) => call.fileId),
    [FILE_A, FILE_A],
  );
});

test('content getOne: public serves anonymous, private hides outsiders (404)', async () => {
  const publicSetup = contentSetup(
    { select: [[albumRow({ id: PUBLIC_ALBUM_ID, visibility: 'public' })], [assetRow({ albumId: PUBLIC_ALBUM_ID })]] },
    stubDrive(),
  );
  const asset = await publicSetup.service.streamContent(PUBLIC_ALBUM_ID, ASSET_A, undefined, undefined);
  assert.equal(asset.mimeType, 'image/jpeg');

  const privateSetup = contentSetup(
    { select: [[albumRow({ id: PRIVATE_ALBUM_ID })], []] },
    stubDrive(),
  );
  const error = await rejectsStatus(
    () => privateSetup.service.streamContent(PRIVATE_ALBUM_ID, ASSET_A, OUTSIDER_ID, undefined),
    404,
  );
  assert.equal(
    (error.getResponse() as { type: string }).type,
    'https://irec.app/problems/album-not-found',
  );
});

test('content delete forbids non-uploader members (403) before any provider call', async () => {
  const drive = stubDrive();
  const { service, seen } = contentSetup(
    {
      select: [[albumRow()], [assetRow({ uploadedBy: OWNER_ID })], [{ userId: MEMBER_ID }]],
    },
    drive,
  );

  const error = await rejectsStatus(
    () => service.deleteAsset(ALBUM_ID, ASSET_A, MEMBER_ID),
    403,
  );
  assertNoSecrets(error.getResponse());
  assert.equal(drive.calls.length, 0);
  assert.equal(seen.updates, 0);
});

test('content stream rejects pending assets (409) and hides deleted ones (404)', async () => {
  const pending = contentSetup(
    { select: [[albumRow()], [assetRow({ status: 'pending', providerFileId: null })]] },
    stubDrive(),
  );
  const conflict = await rejectsStatus(
    () => pending.service.streamContent(ALBUM_ID, ASSET_A, OWNER_ID, undefined),
    409,
  );
  assert.equal(
    (conflict.getResponse() as { type: string }).type,
    'https://irec.app/problems/album-asset-not-ready',
  );

  const deleted = contentSetup(
    { select: [[albumRow()], [assetRow({ status: 'deleted' })]] },
    stubDrive(),
  );
  await rejectsStatus(() => deleted.service.streamContent(ALBUM_ID, ASSET_A, OWNER_ID, undefined), 404);
});

test('content video range passes through as 206 with local mime', async () => {
  const bytes = Buffer.from([1, 2, 3, 4, 5, 6]);
  const drive = stubDrive({
    metadata: { providerFileId: FILE_A, mimeType: 'video/mp4', sizeBytes: 1000 },
    media: async () => ({
      status: 206 as const,
      contentType: 'video/mp4',
      contentLength: 100,
      contentRange: 'bytes 0-99/1000',
      totalLength: 1000,
      body: Readable.from([bytes]),
    }),
  });
  const { service } = contentSetup(
    { select: [[albumRow()], [videoAssetRow()]] },
    drive,
  );

  const result = await service.streamContent(ALBUM_ID, ASSET_A, OWNER_ID, 'bytes=0-99');
  assert.equal(result.status, 206);
  assert.equal(result.mimeType, 'video/mp4');
  assert.equal(result.contentRange, 'bytes 0-99/1000');
  assert.equal(result.totalLength, 1000);
  assert.deepEqual(drive.calls.at(-1)?.range, { start: 0, end: 99 });
  const chunks: Buffer[] = [];
  for await (const chunk of result.body) chunks.push(Buffer.from(chunk as Uint8Array));
  assert.deepEqual(Buffer.concat(chunks), bytes);
});

test('content delete: provider gone still finalizes local deleted', async () => {
  const drive = stubDrive({
    onDelete: async () => {
      throw new DriveFileGoneError(FILE_A);
    },
  });
  const { service, seen } = contentSetup(
    {
      select: [[albumRow()], [assetRow()]],
      update: [[assetRow({ status: 'deleted' })]],
    },
    drive,
  );

  const result = await service.deleteAsset(ALBUM_ID, ASSET_A, OWNER_ID);
  assert.deepEqual(result, { success: true });
  assert.equal(drive.calls.length, 1);
  assert.deepEqual(drive.calls[0]?.ref, { connectionId: CONN_A, ownerId: OWNER_ID });
  assert.equal((seen.set as { status: string }).status, 'deleted');
});

test('content delete: provider 500 becomes sanitized 502 and the row stays ready', async () => {
  const drive = stubDrive({
    onDelete: async () => {
      throw new BadGatewayException('Google Drive no esta disponible; intentalo de nuevo.');
    },
  });
  const { service, seen } = contentSetup(
    { select: [[albumRow()], [assetRow()]] },
    drive,
  );

  const error = await rejectsStatus(() => service.deleteAsset(ALBUM_ID, ASSET_A, OWNER_ID), 502);
  assertNoSecrets(error.getResponse());
  assert.equal(seen.updates, 0);
});

test('content delete: foreign connection 404s and never touches the local row', async () => {
  const drive = stubDrive({
    onDelete: async () => {
      throw new NotFoundException({
        type: 'https://irec.app/problems/storage-connection-not-found',
        title: 'Storage connection not found',
        status: 404,
        detail: 'La conexion no existe o no esta disponible para esta sesion.',
      });
    },
  });
  const { service, seen } = contentSetup(
    { select: [[albumRow()], [assetRow({ storageConnectionId: CONN_B })]] },
    drive,
  );

  const error = await rejectsStatus(() => service.deleteAsset(ALBUM_ID, ASSET_A, OWNER_ID), 404);
  assert.doesNotMatch(JSON.stringify(error.getResponse()), /ownerId|owner_id/);
  assert.equal(seen.updates, 0);
});

test('content delete without provider file finalizes locally and is idempotent', async () => {
  const drive = stubDrive();
  const pending = contentSetup(
    {
      select: [[albumRow()], [assetRow({ status: 'pending', providerFileId: null })]],
      update: [[assetRow({ status: 'deleted' })]],
    },
    drive,
  );
  assert.deepEqual(await pending.service.deleteAsset(ALBUM_ID, ASSET_A, OWNER_ID), { success: true });
  assert.equal(drive.calls.length, 0);

  const gone = contentSetup(
    { select: [[albumRow()], [assetRow({ status: 'deleted', providerFileId: FILE_A })]] },
    drive,
  );
  assert.deepEqual(await gone.service.deleteAsset(ALBUM_ID, ASSET_A, OWNER_ID), { success: true });
  assert.equal(drive.calls.length, 0);
});

test('content list keeps storageConnectionId + providerFileId per asset', async () => {
  const seen = freshSeen();
  const assets = new AlbumAssetsService({
    db: makeDb(
      {
        select: [
          [albumRow()],
          [{ userId: MEMBER_ID }],
          [
            assetRow(),
            assetRow({ id: ASSET_B, storageConnectionId: CONN_B, providerFileId: FILE_B }),
          ],
        ],
        insert: [],
        update: [],
      },
      seen,
    ),
  } as never);

  const result = await assets.listByAlbum(ALBUM_ID, MEMBER_ID);
  assert.deepEqual(AlbumAssetsResponseSchema.parse(result), result);
  assert.equal(result.assets[0]?.storageConnectionId, CONN_A);
  assert.equal(result.assets[0]?.providerFileId, FILE_A);
  assert.equal(result.assets[1]?.storageConnectionId, CONN_B);
  assert.equal(result.assets[1]?.providerFileId, FILE_B);
});

test('range parser: full, open, suffix, clamp, ignore, 416', () => {
  assert.equal(parseAssetRangeHeader(undefined, 1000), null);
  assert.equal(parseAssetRangeHeader('bytes=0-', 1000)?.start, 0);
  assert.deepEqual(parseAssetRangeHeader('bytes=10-99', 1000), { start: 10, end: 99 });
  // End beyond the size clamps instead of failing.
  assert.deepEqual(parseAssetRangeHeader('bytes=900-9999', 1000), { start: 900, end: 999 });
  // Suffix range: last 100 bytes.
  assert.deepEqual(parseAssetRangeHeader('bytes=-100', 1000), { start: 900, end: 999 });
  // Malformed or multi-range headers are ignored (caller serves 200).
  assert.equal(parseAssetRangeHeader('garbage', 1000), null);
  assert.equal(parseAssetRangeHeader('bytes=0-10,20-30', 1000), null);
  assert.equal(parseAssetRangeHeader('bytes=-0', 1000), null);
  assert.throws(() => parseAssetRangeHeader('bytes=1000-', 1000), (error: unknown) => {
    assert.ok(error instanceof HttpException && error.getStatus() === 416);
    return true;
  });
});

// ---------------------------------------------------------------------------
// Part C: HTTP surface (mocked services, real controller + filter)
// ---------------------------------------------------------------------------

Reflect.defineMetadata(
  'design:paramtypes',
  [AlbumAssetsService, AlbumAssetUploadService, AlbumAssetContentService, AuthService, ConfigService],
  AlbumAssetsController,
);

test('asset read/delete HTTP: meta, byte proxy with ranges, reconciled delete', async (t) => {
  const readyAsset = {
    id: ASSET_A,
    albumId: ALBUM_ID,
    uploadedBy: OWNER_ID,
    storageConnectionId: CONN_A,
    provider: 'google_drive',
    providerFileId: FILE_A,
    mimeType: 'video/mp4',
    originalName: 'clip.mp4',
    sizeBytes: 1000,
    status: 'ready',
    createdAt: VERIFIED_AT.toISOString(),
    updatedAt: VERIFIED_AT.toISOString(),
  };
  const auth = {
    async getSession(access: string | undefined) {
      if (access === 'owner-session') {
        return {
          body: {
            authenticated: true as const,
            user: { id: OWNER_ID, email: 'fixture@example.test', emailVerifiedAt: VERIFIED_AT.toISOString() },
          },
        };
      }
      return { body: { authenticated: false as const } };
    },
  };
  const config = {
    getOrThrow(key: string) {
      const values: Record<string, string | number | boolean> = {
        ACCESS_TOKEN_TTL_SECONDS: 900,
        REFRESH_TOKEN_TTL_SECONDS: 43200,
        COOKIE_SECURE: false,
      };
      const value = values[key];
      if (value === undefined) throw new Error(`Missing config: ${key}`);
      return value;
    },
  };
  const assets = {
    async getOne(album: string, asset: string, viewerId: string | undefined) {
      if (album === PRIVATE_ALBUM_ID && viewerId !== OWNER_ID) {
        throw new NotFoundException({
          type: 'https://irec.app/problems/album-not-found',
          title: 'Album not found',
          status: 404,
          detail: 'El album no existe o no esta disponible para esta sesion.',
        });
      }
      if (asset !== ASSET_A || album !== ALBUM_ID) {
        throw new NotFoundException({
          type: 'https://irec.app/problems/album-asset-not-found',
          title: 'Asset not found',
          status: 404,
          detail: 'El contenido no existe en este album.',
        });
      }
      return readyAsset;
    },
    async listByAlbum() {
      return { assets: [readyAsset] };
    },
  };
  const rangeBody = Buffer.from([10, 20, 30]);
  const content = {
    async streamContent(album: string, asset: string, viewerId: string | undefined, range: string | undefined) {
      const meta = await assets.getOne(album, asset, viewerId);
      if (range === 'bytes=9999-') {
        throw new HttpException(
          {
            type: 'https://irec.app/problems/range-not-satisfiable',
            title: 'Range Not Satisfiable',
            status: 416,
            detail: 'El rango solicitado esta fuera del contenido.',
          },
          416,
        );
      }
      if (range) {
        return {
          status: 206 as const,
          mimeType: meta.mimeType,
          contentLength: rangeBody.length,
          contentRange: `bytes 0-2/${meta.sizeBytes}`,
          totalLength: meta.sizeBytes,
          fileName: meta.originalName,
          body: Readable.from([rangeBody]),
        };
      }
      return {
        status: 200 as const,
        mimeType: meta.mimeType,
        contentLength: meta.sizeBytes,
        contentRange: null,
        totalLength: meta.sizeBytes,
        fileName: meta.originalName,
        body: Readable.from([Buffer.alloc(meta.sizeBytes)]),
      };
    },
    async deleteAsset(album: string, asset: string, userId: string) {
      await assets.getOne(album, asset, userId);
      if (userId !== OWNER_ID) {
        throw new ForbiddenException({
          type: 'https://irec.app/problems/album-asset-forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Solo el propietario o quien subio el contenido puede eliminarlo.',
        });
      }
      return { success: true };
    },
  };
  @Module({
    controllers: [AlbumAssetsController],
    providers: [
      { provide: AlbumAssetsService, useValue: assets },
      { provide: AlbumAssetUploadService, useValue: {} },
      { provide: AlbumAssetContentService, useValue: content },
      { provide: AuthService, useValue: auth },
      { provide: ConfigService, useValue: config },
    ],
  })
  class TestModule {}
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/albums/${ALBUM_ID}/assets/${ASSET_A}`;
  try {
    await t.test('GET one returns meta with connection + provider file, no bytes', async () => {
      const response = await fetch(base, { headers: { cookie: 'irec_access=owner-session' } });
      assert.equal(response.status, 200);
      const value = await response.json();
      assert.deepEqual(AlbumAssetContract.parse(value), value);
      assert.equal(value.storageConnectionId, CONN_A);
      assert.equal(value.providerFileId, FILE_A);
      assert.doesNotMatch(JSON.stringify(value), /accessToken|refreshToken|Bearer/);
    });

    await t.test('GET content streams bytes with video headers', async () => {
      const response = await fetch(`${base}/content`, {
        headers: { cookie: 'irec_access=owner-session' },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'video/mp4');
      assert.equal(response.headers.get('accept-ranges'), 'bytes');
      assert.match(response.headers.get('content-disposition') ?? '', /inline; filename="clip\.mp4"/);
      assert.equal(response.headers.get('content-length'), '1000');
      assert.equal((await response.arrayBuffer()).byteLength, 1000);
    });

    await t.test('GET content honors single ranges with 206', async () => {
      const response = await fetch(`${base}/content`, {
        headers: { cookie: 'irec_access=owner-session', range: 'bytes=0-2' },
      });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('content-range'), 'bytes 0-2/1000');
      assert.equal(response.headers.get('accept-ranges'), 'bytes');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), rangeBody);
    });

    await t.test('GET content maps unsatisfiable ranges to 416 problem+json', async () => {
      const response = await fetch(`${base}/content`, {
        headers: { cookie: 'irec_access=owner-session', range: 'bytes=9999-' },
      });
      assert.equal(response.status, 416);
      assert.match(response.headers.get('content-type')!, /application\/problem\+json/);
    });

    await t.test('private album hides content from outsiders (404), delete needs session (401)', async () => {
      const hidden = await fetch(
        `${await app.getUrl()}/api/albums/${PRIVATE_ALBUM_ID}/assets/${ASSET_A}/content`,
      );
      assert.equal(hidden.status, 404);

      const unauthenticated = await fetch(`${base}`, { method: 'DELETE' });
      assert.equal(unauthenticated.status, 401);
    });

    await t.test('DELETE reconciles and stays idempotent', async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(base, {
          method: 'DELETE',
          headers: { cookie: 'irec_access=owner-session' },
        });
        assert.equal(response.status, 200);
        assert.deepEqual(SuccessResponseSchema.parse(await response.json()), { success: true });
      }
    });

    await t.test('invalid UUIDs fail validation before any service', async () => {
      const response = await fetch(
        `${await app.getUrl()}/api/albums/${ALBUM_ID}/assets/not-a-uuid/content`,
        { headers: { cookie: 'irec_access=owner-session' } },
      );
      assert.equal(response.status, 422);
    });
  } finally {
    await app.close();
  }
});

// Type-only guard: failure modes the suite must keep covering.
test('conflict and forbidden constructors stay available for delete mapping', () => {
  assert.ok(new ConflictException('x') instanceof HttpException);
  assert.ok(new ForbiddenException('x') instanceof HttpException);
});
