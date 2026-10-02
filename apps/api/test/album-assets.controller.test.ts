import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, ForbiddenException, Module, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import {
  AlbumAssetContract,
  AlbumAssetsResponseSchema,
  MAX_ALBUM_ASSET_SIZE_BYTES,
  SuccessResponseSchema,
} from '@irec/contracts';

import { AuthService } from '../src/auth/auth.service.js';
import { AlbumAssetContentService } from '../src/albums/album-asset-content.service.js';
import { AlbumAssetUploadService } from '../src/albums/album-asset-upload.service.js';
import { AlbumAssetsController } from '../src/albums/album-assets.controller.js';
import { AlbumAssetsService } from '../src/albums/album-assets.service.js';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter.js';

const owner = 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0';
const member = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
const outsider = 'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2';
const albumId = 'a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3';
const privateAlbumId = 'a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4';
const connectionId = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';
const foreignConnectionId = 'e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6';
const staleConnectionId = 'e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e7e7';
const assetId = 'f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f8f8';
const unknownAssetId = 'f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f9f9';
const verifiedAt = new Date('2026-01-01T00:00:00.000Z');
const userPayload = (id: string) => ({
  id,
  email: 'fixture@example.test',
  emailVerifiedAt: verifiedAt.toISOString(),
});
const pendingAsset = {
  id: assetId,
  albumId,
  uploadedBy: owner,
  storageConnectionId: connectionId,
  provider: 'google_drive',
  providerFileId: null,
  mimeType: 'image/jpeg',
  originalName: 'photo.jpg',
  sizeBytes: 1024,
  status: 'pending',
  createdAt: verifiedAt.toISOString(),
  updatedAt: verifiedAt.toISOString(),
};
const readyAsset = { ...pendingAsset, status: 'ready', providerFileId: 'drive-file-id' };
const baseBody = {
  storageConnectionId: connectionId,
  mimeType: 'image/jpeg',
  originalName: 'photo.jpg',
  sizeBytes: 1024,
};

// tsx does not emit TypeScript's constructor metadata; production tsc does.
Reflect.defineMetadata('design:paramtypes', [AlbumAssetsService, AlbumAssetUploadService, AlbumAssetContentService, AuthService, ConfigService], AlbumAssetsController);

test('album assets thin HTTP (mocked service, no provider, no bytes)', async (t) => {
  const calls = { create: [] as unknown[], list: [] as unknown[], remove: [] as unknown[] };
  const auth = {
    async getSession(access: string | undefined, refresh: string | undefined, trusted: string | undefined) {
      assert.equal(trusted, undefined);
      if (access === 'owner-session') return { body: { authenticated: true as const, user: userPayload(owner) } };
      if (access === 'member-session') return { body: { authenticated: true as const, user: userPayload(member) } };
      if (access === 'outsider-session') return { body: { authenticated: true as const, user: userPayload(outsider) } };
      if (access === 'expired-session' && refresh === 'valid-refresh') {
        return {
          body: { authenticated: true as const, user: userPayload(owner) },
          accessToken: 'rotated-access',
          refreshToken: 'rotated-refresh',
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
    async createPending(album: string, userId: string, body: typeof baseBody) {
      calls.create.push([album, userId, body]);
      if (album === privateAlbumId && userId !== owner) {
        throw new ForbiddenException({
          type: 'https://irec.app/problems/album-asset-forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Solo miembros del album pueden agregar contenido.',
        });
      }
      if (body.storageConnectionId === foreignConnectionId) {
        throw new NotFoundException({
          type: 'https://irec.app/problems/storage-connection-not-found',
          title: 'Storage connection not found',
          status: 404,
          detail: 'La conexion no existe o no esta disponible para esta sesion.',
        });
      }
      if (body.storageConnectionId === staleConnectionId) {
        throw new ConflictException({
          type: 'https://irec.app/problems/storage-connection-not-ready',
          title: 'Storage connection not ready',
          status: 409,
          detail: 'La conexion debe estar verificada antes de agregar contenido.',
        });
      }
      return { ...pendingAsset, albumId: album, uploadedBy: userId, storageConnectionId: body.storageConnectionId };
    },
    async listByAlbum(album: string, viewerId: string | undefined) {
      calls.list.push([album, viewerId]);
      if (album === privateAlbumId && viewerId !== owner) {
        throw new NotFoundException({
          type: 'https://irec.app/problems/album-not-found',
          title: 'Album not found',
          status: 404,
          detail: 'El album no existe o no esta disponible para esta sesion.',
        });
      }
      return { assets: [{ ...readyAsset, albumId: album }] };
    },
    async requestDelete(album: string, asset: string, userId: string) {
      calls.remove.push([album, asset, userId]);
      if (asset === unknownAssetId || album !== albumId) {
        throw new NotFoundException({
          type: 'https://irec.app/problems/album-asset-not-found',
          title: 'Asset not found',
          status: 404,
          detail: 'El contenido no existe en este album.',
        });
      }
      if (userId !== owner) {
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
  // DELETE now reconciles with the provider through the content service;
  // the thin HTTP test reuses the same owner-scoped logic there.
  const content = {
    async deleteAsset(album: string, asset: string, userId: string) {
      return assets.requestDelete(album, asset, userId);
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
  const base = `${await app.getUrl()}/api/albums`;
  async function request(album: string, suffix = '', cookie?: string, method = 'GET', body?: unknown, query = '') {
    const response = await fetch(`${base}/${album}/assets${suffix}${query}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.doesNotMatch(JSON.stringify(value), /accessToken|refreshToken|trustedToken/);
    return { response, value };
  }
  try {
    await t.test('missing or invalid cookies cannot create or delete, but anonymous list stays public', async () => {
      const before = { create: calls.create.length, remove: calls.remove.length };
      for (const cookie of [undefined, 'irec_access=expired-session', 'irec_access=totp-flow']) {
        for (const [suffix, method, body] of [
          ['', 'POST', baseBody],
          [`/${assetId}`, 'DELETE', undefined],
        ] as const) {
          const { response, value } = await request(albumId, suffix, cookie, method, body);
          assert.equal(response.status, 401);
          assert.match(response.headers.get('content-type')!, /application\/problem\+json/);
          assert.equal(value.status, 401);
        }
      }
      assert.equal(calls.create.length, before.create);
      assert.equal(calls.remove.length, before.remove);

      const { response, value } = await request(albumId);
      assert.equal(response.status, 200);
      assert.deepEqual(AlbumAssetsResponseSchema.parse(value), value);
      assert.deepEqual(calls.list.at(-1), [albumId, undefined]);
    });

    await t.test('expired access with a valid refresh reuses the session and rotates HttpOnly cookies', async () => {
      const { response, value } = await request(
        albumId, '', 'irec_access=expired-session; irec_refresh=valid-refresh', 'POST', baseBody,
      );
      assert.equal(response.status, 201);
      assert.deepEqual(AlbumAssetContract.parse(value), value);
      const setCookie = response.headers.get('set-cookie') ?? '';
      assert.match(setCookie, /irec_access=rotated-access/);
      assert.match(setCookie, /irec_refresh=rotated-refresh/);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.deepEqual(calls.create.at(-1), [albumId, owner, baseBody]);
    });

    await t.test('create validates mime, size and name before touching the service', async () => {
      const before = calls.create.length;
      const badBodies = [
        { ...baseBody, mimeType: 'image/svg+xml' },
        { ...baseBody, mimeType: 'application/pdf' },
        { ...baseBody, sizeBytes: 0 },
        { ...baseBody, sizeBytes: MAX_ALBUM_ASSET_SIZE_BYTES + 1 },
        { ...baseBody, originalName: '   ' },
      ];
      for (const body of badBodies) {
        const { response, value } = await request(albumId, '', 'irec_access=owner-session', 'POST', body);
        assert.equal(response.status, 422);
        assert.equal(value.type, 'https://irec.app/problems/validation-error');
      }
      assert.equal(calls.create.length, before);
    });

    await t.test('create uses session identity and never leaks foreign connections (404)', async () => {
      const { response, value } = await request(
        albumId, '', 'irec_access=owner-session', 'POST', { ...baseBody, storageConnectionId: foreignConnectionId },
      );
      assert.equal(response.status, 404);
      assert.equal(value.type, 'https://irec.app/problems/storage-connection-not-found');
      assert.doesNotMatch(JSON.stringify(value), /ownerId|owner_id/);

      const viaQuery = await request(
        albumId, '', 'irec_access=owner-session', 'POST', baseBody, `?ownerId=${outsider}`,
      );
      assert.equal(viaQuery.response.status, 201);
      assert.deepEqual(calls.create.at(-1), [albumId, owner, baseBody]);
    });

    await t.test('non-ready connections conflict (409) and outsiders of private albums are forbidden (403)', async () => {
      const stale = await request(
        albumId, '', 'irec_access=owner-session', 'POST', { ...baseBody, storageConnectionId: staleConnectionId },
      );
      assert.equal(stale.response.status, 409);
      assert.equal(stale.value.type, 'https://irec.app/problems/storage-connection-not-ready');

      const outsiderCreate = await request(
        privateAlbumId, '', 'irec_access=outsider-session', 'POST', baseBody,
      );
      assert.equal(outsiderCreate.response.status, 403);
      assert.equal(outsiderCreate.value.type, 'https://irec.app/problems/album-asset-forbidden');
    });

    await t.test('list hides private albums (404) and returns the fixed contract for members', async () => {
      const hidden = await request(privateAlbumId, '', 'irec_access=outsider-session');
      assert.equal(hidden.response.status, 404);
      assert.equal(hidden.value.type, 'https://irec.app/problems/album-not-found');

      const visible = await request(albumId, '', 'irec_access=member-session');
      assert.equal(visible.response.status, 200);
      assert.deepEqual(AlbumAssetsResponseSchema.parse(visible.value), visible.value);
      assert.equal(visible.value.assets.length, 1);
      assert.deepEqual(calls.list.at(-1), [albumId, member]);
    });

    await t.test('delete is owner-scoped and idempotent', async () => {
      const first = await request(albumId, `/${assetId}`, 'irec_access=owner-session', 'DELETE');
      assert.equal(first.response.status, 200);
      assert.deepEqual(SuccessResponseSchema.parse(first.value), first.value);

      const second = await request(albumId, `/${assetId}`, 'irec_access=owner-session', 'DELETE');
      assert.equal(second.response.status, 200);
      assert.deepEqual(second.value, { success: true });

      const forbidden = await request(albumId, `/${assetId}`, 'irec_access=member-session', 'DELETE');
      assert.equal(forbidden.response.status, 403);

      const crossAlbum = await request(privateAlbumId, `/${assetId}`, 'irec_access=owner-session', 'DELETE');
      assert.equal(crossAlbum.response.status, 404);

      const unknown = await request(albumId, `/${unknownAssetId}`, 'irec_access=owner-session', 'DELETE');
      assert.equal(unknown.response.status, 404);
    });

    await t.test('invalid UUIDs fail validation before the service', async () => {
      const before = { create: calls.create.length, list: calls.list.length, remove: calls.remove.length };
      for (const badAlbum of ['not-a-uuid', '123']) {
        const { response } = await request(badAlbum, '', 'irec_access=owner-session', 'POST', baseBody);
        assert.equal(response.status, 422);
        assert.equal((await request(badAlbum, '', 'irec_access=owner-session')).response.status, 422);
      }
      const { response } = await request(albumId, '/not-a-uuid', 'irec_access=owner-session', 'DELETE');
      assert.equal(response.status, 422);
      assert.deepEqual(
        { create: calls.create.length, list: calls.list.length, remove: calls.remove.length },
        before,
      );
    });
  } finally {
    await app.close();
  }
});
