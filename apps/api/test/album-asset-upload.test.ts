import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  ConflictException,
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
  MAX_ALBUM_ASSET_SIZE_BYTES,
} from '@irec/contracts';

import { AlbumAssetUploadService } from '../src/albums/album-asset-upload.service.js';
import { AlbumAssetsService } from '../src/albums/album-assets.service.js';
import { AlbumAssetsController } from '../src/albums/album-assets.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter.js';
import { GOOGLE_DRIVE_SCOPE } from '../src/storage/google-drive-oauth.service.js';
import { GoogleDriveUploadService } from '../src/storage/google-drive-upload.service.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALBUM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONNECTION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ASSET_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const FILE_ID = 'drive-file-1';
const ROOT_ID = 'root-id';
const SESSION_URI = 'https://www.googleapis.com/upload/drive/v3/session/test-session';
const ENVELOPE = JSON.stringify({
  version: 1,
  refreshToken: 'fixture-refresh-token',
  scope: GOOGLE_DRIVE_SCOPE,
  tokenType: 'Bearer',
});
const TOKEN = { access_token: 'fixture-access', token_type: 'Bearer', expires_in: 3600 };

const albumRow = () => ({
  id: ALBUM_ID,
  ownerId: OWNER_ID,
  title: 'Trip',
  description: null,
  visibility: 'private',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const connectionRow = (overrides = {}) => ({
  id: CONNECTION_ID,
  ownerId: OWNER_ID,
  provider: 'google_drive',
  providerAccountId: 'account',
  displayName: null,
  rootId: ROOT_ID,
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
  sizeBytes: 64,
  status: 'pending',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...overrides,
});

type FakeQueues = { select: unknown[][]; insert: unknown[][]; update: unknown[][] };
type FakeSeen = {
  inserts: number;
  updates: number;
  op: string;
  values: unknown;
  set: unknown;
  predicates: string[];
};

function makeDb(queues: FakeQueues, seen: FakeSeen, order?: string[]) {
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
      order?.push('db:insert');
      return chain;
    },
    update: () => {
      seen.updates += 1;
      seen.op = 'update';
      order?.push('db:update');
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

const domainConnection = (overrides = {}) => ({
  id: CONNECTION_ID,
  ownerId: OWNER_ID,
  provider: 'google_drive' as const,
  providerAccountId: 'account',
  displayName: null,
  rootId: ROOT_ID,
  status: 'ready' as const,
  lastVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const configStub = {
  get: (key: string) =>
    key === 'GOOGLE_OAUTH_CLIENT_ID' || key === 'GOOGLE_OAUTH_CLIENT_SECRET'
      ? 'fixture-oauth-client'
      : undefined,
};

function storageStub(connection: unknown) {
  return {
    async getOwned(id: string, owner: string) {
      assert.equal(id, CONNECTION_ID);
      assert.equal(owner, OWNER_ID);
      return connection;
    },
    async getCredentialEnvelope() {
      return ENVELOPE;
    },
  };
}

interface DriveLog {
  tokens: number;
  inits: { name: string; mimeType: string; parents: string[] }[];
  puts: { range: string; bytes: Buffer }[];
  verifies: number;
  cancels: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function installDriveMock(
  order: string[],
  log: DriveLog,
  opts: { corruptVerify?: 'size' | 'mime'; failOnPut?: number } = {},
): () => void {
  const original = globalThis.fetch;
  const received: Buffer[] = [];
  const total = () => received.reduce((sum, part) => sum + part.length, 0);
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === 'oauth2.googleapis.com') {
      log.tokens += 1;
      order.push('provider:token');
      return json(TOKEN);
    }
    if (url.hostname === 'www.googleapis.com' && url.pathname === '/upload/drive/v3/files') {
      assert.equal(init?.method, 'POST');
      assert.equal(
        (init?.headers as Record<string, string>).authorization,
        'Bearer fixture-access',
      );
      const meta = JSON.parse(String(init?.body));
      log.inits.push(meta);
      order.push('provider:init');
      return new Response('{}', {
        status: 200,
        headers: { location: SESSION_URI },
      });
    }
    if (String(input) === SESSION_URI) {
      if (init?.method === 'DELETE') {
        log.cancels += 1;
        return new Response('{}', { status: 200 });
      }
      const range = (init?.headers as Record<string, string>)['content-range'];
      const body = Buffer.from(init?.body as Buffer);
      log.puts.push({ range, bytes: body });
      order.push(`provider:put:${range}`);
      if (opts.failOnPut !== undefined && log.puts.length === opts.failOnPut) {
        throw new Error('provider-secret-boom');
      }
      const star = /^bytes \*\/(\d+)$/.exec(range);
      if (star) {
        return total() === Number(star[1]) ? json({ id: FILE_ID }) : json({ error: 'x' }, 400);
      }
      const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(range);
      assert.ok(match, `unexpected range ${range}`);
      const start = Number(match[1]);
      const end = Number(match[2]);
      const declared = match[3];
      assert.equal(start, total(), 'chunks must arrive sequentially');
      assert.equal(body.length, end - start + 1);
      received.push(body);
      if (declared === '*') return new Response(null, { status: 308 });
      if (end + 1 === Number(declared) && total() === Number(declared)) {
        return json({ id: FILE_ID });
      }
      return new Response(null, { status: 308 });
    }
    if (url.hostname === 'www.googleapis.com' && url.pathname === `/drive/v3/files/${FILE_ID}`) {
      log.verifies += 1;
      order.push('provider:verify');
      const mime = log.inits[0]?.mimeType ?? 'image/jpeg';
      const size = total();
      if (opts.corruptVerify === 'size') {
        return json({ id: FILE_ID, name: 'photo.jpg', mimeType: mime, size: String(size + 1), parents: [ROOT_ID] });
      }
      if (opts.corruptVerify === 'mime') {
        return json({ id: FILE_ID, name: 'photo.jpg', mimeType: 'video/mp4', size: String(size), parents: [ROOT_ID] });
      }
      return json({ id: FILE_ID, name: 'photo.jpg', mimeType: mime, size: String(size), parents: [ROOT_ID] });
    }
    throw new Error(`unexpected provider call ${String(input)}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const freshLog = (): DriveLog => ({ tokens: 0, inits: [], puts: [], verifies: 0, cancels: 0 });

function multipartBody(
  boundary: string,
  fields: [string, string][],
  file?: { field?: string; filename?: string; contentType?: string; data?: Buffer },
  order: 'fields-first' | 'file-first' = 'fields-first',
): Buffer {
  const chunks: Buffer[] = [];
  const fieldPart = ([name, value]: [string, string]) =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  const filePart = () => {
    assert.ok(file);
    return Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field ?? 'file'}"; filename="${file.filename ?? 'photo.jpg'}"\r\nContent-Type: ${file.contentType ?? 'image/jpeg'}\r\n\r\n`,
      ),
      file.data ?? Buffer.alloc(0),
      Buffer.from('\r\n'),
    ]);
  };
  if (order === 'fields-first') {
    for (const entry of fields) chunks.push(fieldPart(entry));
    if (file) chunks.push(filePart());
  } else {
    if (file) chunks.push(filePart());
    for (const entry of fields) chunks.push(fieldPart(entry));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function splitSource(buffer: Buffer, size: number): AsyncIterable<Buffer> {
  return {
    async *[Symbol.asyncIterator]() {
      for (let offset = 0; offset < buffer.length; offset += size) {
        yield buffer.subarray(offset, Math.min(offset + size, buffer.length));
      }
    },
  };
}

function setup(
  queues: Partial<FakeQueues>,
  drive: { connection?: unknown } = {},
  order?: string[],
) {
  const seen = freshSeen();
  const full: FakeQueues = {
    select: queues.select ?? [],
    insert: queues.insert ?? [],
    update: queues.update ?? [],
  };
  const assets = new AlbumAssetsService({ db: makeDb(full, seen, order) } as never);
  const uploader = new GoogleDriveUploadService(
    configStub as never,
    storageStub(drive.connection ?? domainConnection()) as never,
  );
  return { service: new AlbumAssetUploadService(assets, uploader), seen, assets };
}

const fileBytes = (length: number): Buffer =>
  Buffer.from(Array.from({ length }, (_, i) => i % 251));

function uploadArgs(size: number, connectionId = CONNECTION_ID): [string, string][] {
  return [
    ['storageConnectionId', connectionId],
    ['sizeBytes', String(size)],
  ];
}

async function rejectsStatus(operation: () => Promise<unknown>, status: number): Promise<HttpException> {
  try {
    await operation();
  } catch (error) {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), status);
    return error;
  }
  assert.fail(`expected HTTP ${status}`);
}

function assertNoSecrets(value: unknown): void {
  assert.doesNotMatch(
    JSON.stringify(value),
    /fixture-refresh|fixture-access|provider-secret|test-session/,
  );
}

// ---------------------------------------------------------------------------
// Happy path: streaming, pending-first, verify-before-finalize
// ---------------------------------------------------------------------------

test('upload streams bytes in order across chunk PUTs, pending first, ready after verify', async () => {
  const order: string[] = [];
  const log = freshLog();
  const restore = installDriveMock(order, log);
  try {
    const bytes = fileBytes(64);
    const { service, seen } = setup(
      {
        select: [[albumRow()], [connectionRow()], [assetRow()], [albumRow()]],
        insert: [[assetRow()]],
        update: [[assetRow({ status: 'ready', providerFileId: FILE_ID })]],
      },
      {},
      order,
    );
    const boundary = 'boundary-success-1';
    const body = multipartBody(boundary, uploadArgs(bytes.length), {
      data: bytes,
    });

    const asset = await service.uploadStreaming(
      ALBUM_ID,
      OWNER_ID,
      splitSource(body, 7),
      `multipart/form-data; boundary=${boundary}`,
      { chunkBytes: 7 },
    );

    assert.ok(AlbumAssetContract.safeParse(asset).success);
    assert.equal(asset.status, 'ready');
    assert.equal(asset.providerFileId, FILE_ID);

    // Pending row first, with no provider id yet.
    assert.equal(seen.inserts, 1);
    assert.equal((seen.values as { status: string }).status, 'pending');
    assert.equal((seen.values as { providerFileId: null }).providerFileId, null);
    assert.equal((seen.values as { sizeBytes: number }).sizeBytes, bytes.length);
    // Finalize only after verify: ready + provider id.
    assert.equal((seen.set as { status: string }).status, 'ready');
    assert.equal((seen.set as { providerFileId: string }).providerFileId, FILE_ID);

    // Drive resumable session under the verified root.
    assert.equal(log.tokens, 1);
    assert.equal(log.inits.length, 1);
    assert.deepEqual(log.inits[0], {
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      parents: [ROOT_ID],
    });
    // Streaming proof: every PUT is bounded, bytes arrive in order, no single
    // request carries the whole file.
    assert.ok(log.puts.length > 1, `expected multiple PUTs, got ${log.puts.length}`);
    for (const put of log.puts) {
      assert.ok(put.bytes.length <= 7, `PUT exceeded the chunk budget: ${put.bytes.length}`);
    }
    assert.deepEqual(Buffer.concat(log.puts.map((put) => put.bytes)), bytes);
    const last = log.puts.at(-1);
    assert.match(last?.range ?? '', /\/64$/);
    for (const put of log.puts.slice(0, -1)) assert.match(put.range, /\/\*$/);
    assert.equal(log.verifies, 1);

    // Pending insert precedes the first provider PUT; verify precedes finalize.
    const insertAt = order.indexOf('db:insert');
    const firstPut = order.findIndex((entry) => entry.startsWith('provider:put'));
    const verifyAt = order.indexOf('provider:verify');
    const updateAt = order.indexOf('db:update');
    assert.ok(insertAt >= 0 && firstPut > insertAt);
    assert.ok(verifyAt > firstPut && updateAt > verifyAt);
  } finally {
    restore();
  }
});

test('fragmented boundaries across 1-byte reads still stream exactly', async () => {
  const order: string[] = [];
  const log = freshLog();
  const restore = installDriveMock(order, log);
  try {
    const bytes = fileBytes(25);
    const { service } = setup({
      select: [[albumRow()], [connectionRow()], [assetRow()], [albumRow()]],
      insert: [[assetRow()]],
      update: [[assetRow({ status: 'ready', providerFileId: FILE_ID })]],
    });
    const boundary = 'x-fragmented-boundary-xyz';
    const body = multipartBody(boundary, uploadArgs(bytes.length), { data: bytes });

    const asset = await service.uploadStreaming(
      ALBUM_ID,
      OWNER_ID,
      splitSource(body, 1),
      `multipart/form-data; boundary=${boundary}`,
      { chunkBytes: 9 },
    );

    assert.equal(asset.status, 'ready');
    assert.deepEqual(Buffer.concat(log.puts.map((put) => put.bytes)), bytes);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Verify-before-finalize is structural: mismatches never become ready
// ---------------------------------------------------------------------------

for (const corruptVerify of ['size', 'mime'] as const) {
  test(`provider ${corruptVerify} mismatch fails closed: failed state + 502, never ready`, async () => {
    const order: string[] = [];
    const log = freshLog();
    const restore = installDriveMock(order, log, { corruptVerify });
    try {
      const bytes = fileBytes(32);
      const { service, seen } = setup({
        select: [[albumRow()], [connectionRow()], [assetRow()], [albumRow()]],
        insert: [[assetRow()]],
        update: [[assetRow({ status: 'failed' })]],
      });
      const boundary = `boundary-bad-${corruptVerify}`;
      const body = multipartBody(boundary, uploadArgs(bytes.length), { data: bytes });

      const error = await rejectsStatus(
        () =>
          service.uploadStreaming(
            ALBUM_ID,
            OWNER_ID,
            splitSource(body, 11),
            `multipart/form-data; boundary=${boundary}`,
            { chunkBytes: 11 },
          ),
        502,
      );

      assert.equal((seen.set as { status: string }).status, 'failed');
      assert.doesNotMatch(JSON.stringify(seen.set), /"ready"/);
      assertNoSecrets(error.getResponse());
      assertNoSecrets(seen);
    } finally {
      restore();
    }
  });
}

test('provider transport failure marks failed + 502 without leaks', async () => {
  const order: string[] = [];
  const log = freshLog();
  const restore = installDriveMock(order, log, { failOnPut: 2 });
  try {
    const bytes = fileBytes(40);
    const { service, seen } = setup({
      select: [[albumRow()], [connectionRow()], [assetRow()], [albumRow()]],
      insert: [[assetRow()]],
      update: [[assetRow({ status: 'failed' })]],
    });
    const boundary = 'boundary-transport-fail';
    const body = multipartBody(boundary, uploadArgs(bytes.length), { data: bytes });

    const error = await rejectsStatus(
      () =>
        service.uploadStreaming(
          ALBUM_ID,
          OWNER_ID,
          splitSource(body, 13),
          `multipart/form-data; boundary=${boundary}`,
          { chunkBytes: 13 },
        ),
      502,
    );

    assert.equal((seen.set as { status: string }).status, 'failed');
    assert.equal(log.verifies, 0);
    assertNoSecrets(error.getResponse());
    assertNoSecrets(seen);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Tenant isolation + pre-byte guards
// ---------------------------------------------------------------------------

test('foreign connection 404s without touching the provider or inserting', async () => {
  const log = freshLog();
  const restore = installDriveMock([], log);
  try {
    const bytes = fileBytes(16);
    // Owner predicate finds nothing: foreign connections read as missing.
    const { service, seen } = setup({ select: [[albumRow()], []] });
    const boundary = 'boundary-foreign';
    const body = multipartBody(
      boundary,
      uploadArgs(bytes.length, '12345678-1234-4234-8234-123456789012'),
      { data: bytes },
    );

    const error = await rejectsStatus(
      () =>
        service.uploadStreaming(
          ALBUM_ID,
          OWNER_ID,
          splitSource(body, 9),
          `multipart/form-data; boundary=${boundary}`,
        ),
      404,
    );

    assert.equal(log.tokens, 0);
    assert.equal(log.inits.length, 0);
    assert.equal(seen.inserts, 0);
    const predicate = seen.predicates.at(-1) ?? '';
    assert.match(predicate, /"owner_id"/);
    assert.doesNotMatch(JSON.stringify(error.getResponse()), /ownerId|owner_id/);
  } finally {
    restore();
  }
});

test('non-allowlist mime is rejected 422 before any insert or provider call', async () => {
  const log = freshLog();
  const restore = installDriveMock([], log);
  try {
    const bytes = fileBytes(16);
    const { service, seen } = setup({ select: [] });
    const boundary = 'boundary-bad-mime';
    const body = multipartBody(boundary, uploadArgs(bytes.length), {
      contentType: 'image/gif',
      data: bytes,
    });

    await rejectsStatus(
      () =>
        service.uploadStreaming(
          ALBUM_ID,
          OWNER_ID,
          splitSource(body, 9),
          `multipart/form-data; boundary=${boundary}`,
        ),
      422,
    );

    assert.equal(seen.inserts, 0);
    assert.equal(log.tokens, 0);
    assert.equal(log.inits.length, 0);
  } finally {
    restore();
  }
});

test('declared size above the cap is rejected 422 before any insert or provider call', async () => {
  const log = freshLog();
  const restore = installDriveMock([], log);
  try {
    const { service, seen } = setup({ select: [] });
    const boundary = 'boundary-too-big';
    const body = multipartBody(
      boundary,
      uploadArgs(MAX_ALBUM_ASSET_SIZE_BYTES + 1),
      { data: fileBytes(8) },
    );

    await rejectsStatus(
      () =>
        service.uploadStreaming(
          ALBUM_ID,
          OWNER_ID,
          splitSource(body, 9),
          `multipart/form-data; boundary=${boundary}`,
        ),
      422,
    );

    assert.equal(seen.inserts, 0);
    assert.equal(log.tokens, 0);
  } finally {
    restore();
  }
});

test('actual bytes beyond the declared size fail the pending asset with 422', async () => {
  const order: string[] = [];
  const log = freshLog();
  const restore = installDriveMock(order, log);
  try {
    const { service, seen } = setup({
      select: [[albumRow()], [connectionRow()], [assetRow()], [albumRow()]],
      insert: [[assetRow()]],
      update: [[assetRow({ status: 'failed' })]],
    });
    const boundary = 'boundary-overrun';
    // Declares 10 bytes but sends 20.
    const body = multipartBody(boundary, uploadArgs(10), { data: fileBytes(20) });

    await rejectsStatus(
      () =>
        service.uploadStreaming(
          ALBUM_ID,
          OWNER_ID,
          splitSource(body, 9),
          `multipart/form-data; boundary=${boundary}`,
          { chunkBytes: 64 },
        ),
      422,
    );

    assert.equal((seen.set as { status: string }).status, 'failed');
  } finally {
    restore();
  }
});

test('truncated bodies and missing files 422 without silent orphans', async () => {
  {
    const log = freshLog();
    const restore = installDriveMock([], log);
    try {
      const { service, seen } = setup({
        select: [[albumRow()], [connectionRow()], [assetRow()], [albumRow()]],
        insert: [[assetRow()]],
        update: [[assetRow({ status: 'failed' })]],
      });
      const boundary = 'boundary-truncated';
      const full = multipartBody(boundary, uploadArgs(30), { data: fileBytes(30) });
      const cut = full.subarray(0, full.length - 24);

      await rejectsStatus(
        () =>
          service.uploadStreaming(
            ALBUM_ID,
            OWNER_ID,
            splitSource(cut, 7),
            `multipart/form-data; boundary=${boundary}`,
            { chunkBytes: 64 },
          ),
        422,
      );

      assert.equal((seen.set as { status: string }).status, 'failed');
    } finally {
      restore();
    }
  }
  {
    const log = freshLog();
    const restore = installDriveMock([], log);
    try {
      const { service, seen } = setup({ select: [] });
      const boundary = 'boundary-no-file';
      const body = multipartBody(boundary, uploadArgs(10));

      await rejectsStatus(
        () =>
          service.uploadStreaming(
            ALBUM_ID,
            OWNER_ID,
            splitSource(body, 7),
            `multipart/form-data; boundary=${boundary}`,
          ),
        422,
      );

      assert.equal(seen.inserts, 0);
      assert.equal(log.tokens, 0);
    } finally {
      restore();
    }
  }
});

// ---------------------------------------------------------------------------
// markFailed transitions
// ---------------------------------------------------------------------------

test('markFailed moves pending to failed, is idempotent, and never touches ready', async () => {
  const pending = setup({
    select: [[assetRow()], [albumRow()]],
    update: [[assetRow({ status: 'failed' })]],
  });
  const failed = await pending.assets.markFailed(ASSET_ID, OWNER_ID);
  assert.equal(failed.status, 'failed');
  assert.equal((pending.seen.set as { status: string }).status, 'failed');

  const again = setup({ select: [[assetRow({ status: 'failed' })], [albumRow()]] });
  assert.equal((await again.assets.markFailed(ASSET_ID, OWNER_ID)).status, 'failed');
  assert.equal(again.seen.updates, 0);

  const ready = setup({
    select: [[assetRow({ status: 'ready', providerFileId: FILE_ID })], [albumRow()]],
  });
  await assert.rejects(ready.assets.markFailed(ASSET_ID, OWNER_ID), ConflictException);
  assert.equal(ready.seen.updates, 0);
});

// ---------------------------------------------------------------------------
// Controller: session auth, validation before service, no token leaks
// ---------------------------------------------------------------------------

const owner = 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0';
const albumId = 'a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3';
const verifiedAt = new Date('2026-01-01T00:00:00.000Z');

Reflect.defineMetadata(
  'design:paramtypes',
  [AlbumAssetsService, AlbumAssetUploadService, AuthService, ConfigService],
  AlbumAssetsController,
);

test('upload HTTP: auth, validation, and contract passthrough (mocked services)', async (t) => {
  const calls: unknown[] = [];
  const auth = {
    async getSession(access: string | undefined) {
      if (access === 'owner-session') {
        return {
          body: {
            authenticated: true as const,
            user: { id: owner, email: 'fixture@example.test', emailVerifiedAt: verifiedAt.toISOString() },
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
  const readyAsset = {
    id: 'f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f8f8',
    albumId,
    uploadedBy: owner,
    storageConnectionId: 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5',
    provider: 'google_drive',
    providerFileId: 'drive-file-1',
    mimeType: 'image/jpeg',
    originalName: 'photo.jpg',
    sizeBytes: 4,
    status: 'ready',
    createdAt: verifiedAt.toISOString(),
    updatedAt: verifiedAt.toISOString(),
  };
  const uploads = {
    async uploadStreaming(album: string, userId: string) {
      calls.push([album, userId]);
      return readyAsset;
    },
  };
  @Module({
    controllers: [AlbumAssetsController],
    providers: [
      { provide: AlbumAssetsService, useValue: {} },
      { provide: AlbumAssetUploadService, useValue: uploads },
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
  const base = `${await app.getUrl()}/api/albums`;
  try {
    await t.test('missing session is 401 before the upload service', async () => {
      const response = await fetch(`${base}/${albumId}/assets/upload`, {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=abc' },
        body: '--abc--\r\n',
      });
      assert.equal(response.status, 401);
      assert.equal(calls.length, 0);
      assert.doesNotMatch(JSON.stringify(await response.json()), /accessToken|refreshToken/);
    });

    await t.test('invalid album UUID is 422 before the upload service', async () => {
      const before = calls.length;
      const response = await fetch(`${base}/not-a-uuid/assets/upload`, {
        method: 'POST',
        headers: {
          cookie: 'irec_access=owner-session',
          'content-type': 'multipart/form-data; boundary=abc',
        },
        body: '--abc--\r\n',
      });
      assert.equal(response.status, 422);
      assert.equal(calls.length, before);
    });

    await t.test('session identity reaches the service and the ready contract is returned', async () => {
      const boundary = 'ctrl-boundary';
      const body = multipartBody(boundary, uploadArgs(4), { data: Buffer.from([1, 2, 3, 4]) });
      const response = await fetch(`${base}/${albumId}/assets/upload`, {
        method: 'POST',
        headers: {
          cookie: 'irec_access=owner-session',
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      assert.equal(response.status, 201);
      const value = await response.json();
      assert.deepEqual(AlbumAssetContract.parse(value), value);
      assert.deepEqual(calls.at(-1), [albumId, owner]);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.doesNotMatch(JSON.stringify(value), /accessToken|refreshToken|trustedToken/);
    });

    await t.test('foreign connections surface as 404 without owner leakage', async () => {
      const failing = {
        async uploadStreaming() {
          throw new NotFoundException({
            type: 'https://irec.app/problems/storage-connection-not-found',
            title: 'Storage connection not found',
            status: 404,
            detail: 'La conexion no existe o no esta disponible para esta sesion.',
          });
        },
      };
      const scoped = await NestFactory.create(
        (() => {
          @Module({
            controllers: [AlbumAssetsController],
            providers: [
              { provide: AlbumAssetsService, useValue: {} },
              { provide: AlbumAssetUploadService, useValue: failing },
              { provide: AuthService, useValue: auth },
              { provide: ConfigService, useValue: config },
            ],
          })
          class ScopedModule {}
          return ScopedModule;
        })(),
        { logger: false },
      );
      scoped.setGlobalPrefix('api');
      scoped.use(cookieParser());
      scoped.useGlobalFilters(new ProblemDetailsFilter());
      await scoped.listen(0, '127.0.0.1');
      try {
        const response = await fetch(
          `${await scoped.getUrl()}/api/albums/${albumId}/assets/upload`,
          {
            method: 'POST',
            headers: {
              cookie: 'irec_access=owner-session',
              'content-type': 'multipart/form-data; boundary=abc',
            },
            body: '--abc--\r\n',
          },
        );
        assert.equal(response.status, 404);
        assert.doesNotMatch(JSON.stringify(await response.json()), /ownerId|owner_id/);
      } finally {
        await scoped.close();
      }
    });
  } finally {
    await app.close();
  }
});
