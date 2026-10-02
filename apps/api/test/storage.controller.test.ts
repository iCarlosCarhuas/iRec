import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Module, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import {
  StorageConnectionContract,
  StorageConnectionsResponseSchema,
} from '@irec/contracts';

import { AuthService } from '../src/auth/auth.service.js';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter.js';
import { GoogleDriveRootService } from '../src/storage/google-drive-root.service.js';
import { StorageConnectionService } from '../src/storage/storage-connection.service.js';
import { StorageController } from '../src/storage/storage.controller.js';

const owner = 'f70c7f10-8674-479a-830b-96bb06acfd20';
const otherOwner = 'aa055530-645a-49cc-a6e6-4f9712098e74';
const connectionId = 'a24a3ae5-44ea-407c-97c7-523e23659c23';
const otherId = 'b24a3ae5-44ea-407c-97c7-523e23659c23';
const verifiedAt = new Date('2026-01-01T00:00:00.000Z');
const userPayload = (id: string) => ({
  id,
  email: 'fixture@example.test',
  emailVerifiedAt: verifiedAt.toISOString(),
});
const stored = {
  id: connectionId, ownerId: owner, provider: 'google_drive', displayName: 'Drive',
  status: 'ready', lastVerifiedAt: verifiedAt, rootId: 'private-root',
  providerAccountId: 'private-account', credentialsEncrypted: 'private-ciphertext',
  credentialEnvelope: 'private-envelope', accessToken: 'private-token',
};
const expected = {
  id: connectionId, provider: 'google_drive', displayName: 'Drive',
  status: 'ready', lastVerifiedAt: verifiedAt.toISOString(),
};

// tsx does not emit TypeScript's constructor metadata; production tsc does.
Reflect.defineMetadata('design:paramtypes', [StorageConnectionService, GoogleDriveRootService, AuthService, ConfigService], StorageController);

test('authenticated storage HTTP contracts', async (t) => {
  const lists: string[] = [];
  const prepares: [string, string][] = [];
  let failPrepare = false;
  const auth = {
    async getSession(access: string | undefined, refresh: string | undefined, trusted: string | undefined) {
      assert.equal(trusted, undefined);
      if (access === 'owner-session') return { body: { authenticated: true as const, user: userPayload(owner) } };
      if (access === 'other-session') return { body: { authenticated: true as const, user: userPayload(otherOwner) } };
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
  const storage = {
    async listOwned(id: string) { lists.push(id); return id === owner ? [stored] : []; },
  };
  const roots = {
    async prepareRoot(id: string, userId: string) {
      prepares.push([id, userId]);
      if (id !== connectionId || userId !== owner) throw new NotFoundException('Storage connection not found.');
      if (failPrepare) throw new ServiceUnavailableException('Google Drive is unavailable; try again later.');
      return stored;
    },
  };
  @Module({
    controllers: [StorageController],
    providers: [
      { provide: StorageConnectionService, useValue: storage },
      { provide: GoogleDriveRootService, useValue: roots },
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
  const base = `${await app.getUrl()}/api/storage/connections`;
  async function request(path = '', cookie?: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.doesNotMatch(JSON.stringify(value), /private-|ownerId|providerAccountId|rootId|credentials|accessToken|stack/);
    return { response, value };
  }
  try {
    await t.test('missing, invalid and non-access cookies cannot list or prepare', async () => {
      for (const cookie of [undefined, 'irec_access=expired-session', 'irec_access=totp-flow']) {
        for (const [path, method] of [['', 'GET'], [`/${connectionId}/prepare`, 'POST']]) {
          const { response, value } = await request(path, cookie, method);
          assert.equal(response.status, 401);
          assert.match(response.headers.get('content-type')!, /application\/problem\+json/);
          assert.equal(value.status, 401);
        }
      }
      assert.deepEqual(lists, []);
      assert.deepEqual(prepares, []);
    });
    await t.test('expired access with a valid refresh reuses the stable session and rotates cookies', async () => {
      const { response, value } = await request('', 'irec_access=expired-session; irec_refresh=valid-refresh');
      assert.equal(response.status, 200);
      assert.deepEqual(value, { connections: [expected] });
      const setCookie = response.headers.get('set-cookie') ?? '';
      assert.match(setCookie, /irec_access=rotated-access/);
      assert.match(setCookie, /irec_refresh=rotated-refresh/);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.deepEqual(lists, [owner]);
    });
    await t.test('list uses only session ownership and explicitly projects the DTO', async () => {
      const { response, value } = await request(`?ownerId=${otherOwner}`, 'irec_access=owner-session');
      assert.equal(response.status, 200);
      assert.deepEqual(value, { connections: [expected] });
      assert.deepEqual(StorageConnectionsResponseSchema.parse(value), value);
      assert.deepEqual(lists, [owner, owner]);
      assert.deepEqual((await request('', 'irec_access=other-session')).value, { connections: [] });
    });
    await t.test('prepare ignores client ownership and returns a minimal verified DTO', async () => {
      const { response, value } = await request(`/${connectionId}/prepare?ownerId=${otherOwner}`, 'irec_access=owner-session', 'POST', { ownerId: otherOwner });
      assert.equal(response.status, 200);
      assert.deepEqual(value, expected);
      assert.deepEqual(StorageConnectionContract.parse(value), value);
      assert.deepEqual(prepares, [[connectionId, owner]]);
    });
    await t.test('foreign and missing connections have indistinguishable sanitized errors', async () => {
      for (const [id, cookie] of [[connectionId, 'irec_access=other-session'], [otherId, 'irec_access=owner-session']]) {
        const { response, value } = await request(`/${id}/prepare`, cookie, 'POST');
        assert.equal(response.status, 404);
        assert.equal(value.detail, 'Storage connection not found.');
      }
      assert.deepEqual(prepares.slice(1), [[connectionId, otherOwner], [otherId, owner]]);
    });
    await t.test('invalid UUIDs fail validation before provider work', async () => {
      const before = prepares.length;
      for (const id of ['not-a-uuid', '123', 'a24a3ae5-44ea-407c-97c7-523e23659c2z']) {
        const { response, value } = await request(`/${id}/prepare`, 'irec_access=owner-session', 'POST');
        assert.equal(response.status, 422);
        assert.equal(value.type, 'https://irec.app/problems/validation-error');
        assert.equal(value.errors[0].path, 'connectionId');
      }
      assert.equal(prepares.length, before);
    });
    await t.test('failed prepare returns a problem, never historical ready as success', async () => {
      failPrepare = true;
      const { response, value } = await request(`/${connectionId}/prepare`, 'irec_access=owner-session', 'POST');
      assert.equal(response.status, 503);
      assert.equal(value.detail, 'Google Drive is unavailable; try again later.');
      assert.equal('connections' in value, false);
      assert.equal('lastVerifiedAt' in value, false);
      assert.deepEqual((await request('', 'irec_access=owner-session')).value, { connections: [expected] });
    });
  } finally {
    await app.close();
  }
});
