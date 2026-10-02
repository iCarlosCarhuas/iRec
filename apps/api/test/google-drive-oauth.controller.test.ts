import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadGatewayException, Module, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AuthService } from '../src/auth/auth.service.js';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter.js';
import { GoogleDriveOAuthController } from '../src/storage/google-drive-oauth.controller.js';
import { GoogleDriveRootService } from '../src/storage/google-drive-root.service.js';
import { GoogleDriveOAuthService, GOOGLE_DRIVE_SCOPE } from '../src/storage/google-drive-oauth.service.js';

// tsx does not emit constructor metadata; production tsc does.
Reflect.defineMetadata('design:paramtypes', [GoogleDriveOAuthService, GoogleDriveRootService, AuthService, ConfigService], GoogleDriveOAuthController);

test('Google OAuth callback HTTP redirect and authentication', async (t) => {
  const owner = 'fixture-owner';
  const states = new Map<string, string>();
  const persisted: string[] = [];
  const prepared: [string, string][] = [];
  let providerCalls = 0;
  let providerFailure = false;
  let prepareFailure: { status: number; message: string } | null = null;
  let drivePermissionId = 'private-account';
  let publicWebUrl: string | undefined = 'https://web.example.test/old?discard=yes#discard';
  const config = {
    get(key: string) {
      const values: Record<string, string | undefined> = {
        PUBLIC_WEB_URL: publicWebUrl,
        GOOGLE_OAUTH_CLIENT_ID: 'fixture-client',
        GOOGLE_OAUTH_CLIENT_SECRET: 'fixture-secret',
        GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.test/api/storage/google/callback',
      };
      return values[key];
    },
    getOrThrow(key: string) {
      if (key === 'ACCESS_TOKEN_TTL_SECONDS') return 900;
      if (key === 'REFRESH_TOKEN_TTL_SECONDS') return 43200;
      if (key === 'COOKIE_SECURE') return false;
      const value = this.get(key);
      if (value === undefined) throw new Error('Missing config');
      return value;
    },
  };
  function state(value: string, userId = owner): string {
    states.set(`irec:storage:google-oauth:${value}`, JSON.stringify({
      ownerId: userId, createdAt: new Date().toISOString(),
    }));
    return value;
  }
  const oauth = new GoogleDriveOAuthService(
    config as never,
    { randomToken: () => 'connect-state', hashOpaque: (value: string) => value } as never,
    {
      async connect() {},
      client: {
        async set(key: string, value: string) { states.set(key, value); return 'OK'; },
        async call(command: string, key: string) {
          assert.equal(command, 'GETDEL');
          const value = states.get(key) ?? null;
          states.delete(key);
          return value;
        },
      },
    } as never,
    {
      async upsert(userId: string, input: { providerAccountId: string }) {
        persisted.push(userId);
        return {
          id: `fixture-connection-${input.providerAccountId}`, status: 'pending',
          rootId: 'private-root', credentialsEncrypted: 'private-ciphertext',
          credentialEnvelope: 'private-envelope', accessToken: 'private-access',
        };
      },
    } as never,
  );
  const roots = {
    async prepareRoot(id: string, userId: string) {
      prepared.push([id, userId]);
      if (prepareFailure) {
        const failure = prepareFailure;
        if (failure.status >= 500) throw new BadGatewayException(failure.message);
        throw new UnauthorizedException(failure.message);
      }
      return { id, status: 'ready', rootId: 'private-root', lastVerifiedAt: new Date() };
    },
  };
  const auth = {
    async getSession(access: string | undefined, refresh: string | undefined, trusted: string | undefined) {
      assert.equal(trusted, undefined);
      if (access === 'owner-session') return { body: { authenticated: true as const, user: { id: owner } } };
      if (access === 'other-session') return { body: { authenticated: true as const, user: { id: 'other-owner' } } };
      if (access === 'expired-session' && refresh === 'valid-refresh') {
        return {
          body: { authenticated: true as const, user: { id: owner } },
          accessToken: 'rotated-access',
          refreshToken: 'rotated-refresh',
        };
      }
      return { body: { authenticated: false as const } };
    },
  };
  @Module({
    controllers: [GoogleDriveOAuthController],
    providers: [
      { provide: GoogleDriveOAuthService, useValue: oauth },
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
  const base = `${await app.getUrl()}/api/storage/google`;
  const clientFetch = globalThis.fetch;
  // All Google requests are synthetic. Local HTTP uses the captured client fetch.
  globalThis.fetch = (async (input: string | URL | Request) => {
    providerCalls += 1;
    if (String(input) === 'https://oauth2.googleapis.com/token') {
      return Response.json(providerFailure ? { error: 'private-provider-detail' } : {
        access_token: 'private-access', refresh_token: 'private-refresh', scope: GOOGLE_DRIVE_SCOPE,
      }, { status: providerFailure ? 400 : 200 });
    }
    assert.equal(new URL(String(input)).origin, 'https://www.googleapis.com');
    return Response.json({ user: { permissionId: drivePermissionId, displayName: 'Fixture Drive' } });
  }) as typeof fetch;

  async function request(path: string, cookie = 'irec_access=owner-session', headers: Record<string, string> = {}) {
    return clientFetch(`${base}/${path}`, {
      redirect: 'manual', headers: { cookie, ...headers },
    });
  }
  async function problem(response: Response, status: number, detail?: string) {
    assert.equal(response.status, status);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.match(response.headers.get('content-type')!, /application\/problem\+json/);
    const value = await response.json();
    assert.equal(value.status, status);
    if (detail) assert.equal(value.detail, detail);
    assert.doesNotMatch(JSON.stringify(value), /private-|fixture-code|stack|credentials|rootId/);
  }
  try {
    await t.test('only authenticated sessions can connect or callback; expired access needs a valid refresh', async () => {
      state('auth-state');
      for (const cookie of ['', 'irec_access=expired', 'irec_access=expired-session', 'irec_auth_flow=owner-session', 'irec_refresh=owner-session', 'irec_access=expired-session; irec_refresh=stale-refresh']) {
        await problem(await request('connect', cookie), 401);
        await problem(await request('callback?code=fixture-code&state=auth-state', cookie), 401);
        await problem(await request('callback?error=access_denied&state=auth-state', cookie), 401);
      }
      assert.equal(states.has('irec:storage:google-oauth:auth-state'), true);
      assert.equal(providerCalls, 0);
      assert.deepEqual(persisted, []);
      assert.deepEqual(prepared, []);
    });
    await t.test('expired access with a valid refresh connects and rotates cookies', async () => {
      const response = await request('connect?redirect=https://evil.example', 'irec_access=expired-session; irec_refresh=valid-refresh');
      assert.equal(response.status, 302);
      const setCookie = response.headers.get('set-cookie') ?? '';
      assert.match(setCookie, /irec_access=rotated-access/);
      assert.match(setCookie, /irec_refresh=rotated-refresh/);
      const location = new URL(response.headers.get('location')!);
      assert.equal(location.origin, 'https://accounts.google.com');
      assert.equal(location.searchParams.get('state'), 'connect-state');
    });
    await t.test('connect preserves the backend Google authorization route', async () => {
      const response = await request('connect?redirect=https://evil.example');
      assert.equal(response.status, 302);
      const location = new URL(response.headers.get('location')!);
      assert.equal(location.origin, 'https://accounts.google.com');
      assert.equal(location.searchParams.get('scope'), GOOGLE_DRIVE_SCOPE);
      assert.equal(location.searchParams.get('state'), 'connect-state');
      assert.equal(states.has('irec:storage:google-oauth:connect-state'), true);
    });
    await t.test('successful callback auto-prepares the root then redirects without connection data', async () => {
      state('success-state');
      const response = await request(
        'callback?code=fixture-code&state=success-state&redirect=https://evil.example&next=//evil.example&token=private-input',
        'irec_access=owner-session',
        { host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'http' },
      );
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'https://web.example.test/settings/storage');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(response.headers.get('set-cookie'), null);
      assert.doesNotMatch(await response.text(), /private-|fixture-code|success-state|rootId|credentials|evil\.example/);
      assert.deepEqual(persisted, [owner]);
      assert.deepEqual(prepared, [['fixture-connection-private-account', owner]]);
      assert.equal(providerCalls, 2);
      await problem(await request('callback?code=fixture-code&state=success-state'), 400, 'OAuth state invalido o expirado.');
      assert.equal(providerCalls, 2);
    });
    await t.test('expired access with a valid refresh completes the callback and rotates cookies', async () => {
      state('rotated-state');
      const response = await request(
        'callback?code=fixture-code&state=rotated-state',
        'irec_access=expired-session; irec_refresh=valid-refresh',
      );
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'https://web.example.test/settings/storage');
      const setCookie = response.headers.get('set-cookie') ?? '';
      assert.match(setCookie, /irec_access=rotated-access/);
      assert.match(setCookie, /irec_refresh=rotated-refresh/);
      assert.deepEqual(persisted, [owner, owner]);
      assert.deepEqual(prepared.slice(1), [['fixture-connection-private-account', owner]]);
    });
    await t.test('same Google account reuses its connection; a different account prepares separately', async () => {
      state('reuse-state');
      await request('callback?code=fixture-code&state=reuse-state');
      assert.deepEqual(prepared.slice(-1), [['fixture-connection-private-account', owner]]);
      drivePermissionId = 'private-account-2';
      state('second-account-state');
      await request('callback?code=fixture-code&state=second-account-state');
      assert.deepEqual(prepared.slice(-1), [['fixture-connection-private-account-2', owner]]);
      drivePermissionId = 'private-account';
    });
    await t.test('auto-prepare failures map to 400/502 without leaking tokens', async () => {
      prepareFailure = { status: 401, message: 'Google Drive authorization is invalid; reconnect.' };
      state('stale-credential-state');
      await problem(
        await request('callback?code=fixture-code&state=stale-credential-state'),
        400,
        'Google Drive authorization is invalid; reconnect.',
      );
      prepareFailure = { status: 503, message: 'Google Drive is unavailable; try again later.' };
      state('outage-state');
      await problem(
        await request('callback?code=fixture-code&state=outage-state'),
        502,
        'Google Drive is unavailable; try again later.',
      );
      prepareFailure = null;
    });
    await t.test('incomplete, expired and foreign-owner state cannot redirect or reach the provider', async () => {
      const before = providerCalls;
      for (const query of ['state=unused', 'code=fixture-code', '']) {
        await problem(await request(`callback?${query}`), 400, 'OAuth callback incompleto.');
      }
      await problem(await request('callback?code=fixture-code&state=expired'), 400, 'OAuth state invalido o expirado.');
      state('foreign-state');
      await problem(await request('callback?code=fixture-code&state=foreign-state', 'irec_access=other-session'), 400, 'OAuth state invalido o expirado.');
      assert.equal(states.has('irec:storage:google-oauth:foreign-state'), false);
      assert.equal(providerCalls, before);
    });
    await t.test('cancellation consumes state once and retains sanitized failure messages', async () => {
      state('cancel-state');
      await problem(await request('callback?error=access_denied&state=cancel-state'), 400, 'La autorizacion de Google Drive fue cancelada.');
      await problem(await request('callback?error=access_denied&state=cancel-state'), 400, 'OAuth state invalido o expirado.');
      state('error-state');
      await problem(await request('callback?error=private-error&state=error-state'), 400, 'Google OAuth no pudo completar la autorizacion.');
      await problem(await request('callback?error=access_denied'), 400, 'OAuth state invalido o expirado.');
    });
    await t.test('provider failure never becomes a success redirect and consumes state', async () => {
      providerFailure = true;
      state('provider-state');
      await problem(await request('callback?code=fixture-code&state=provider-state'), 502, 'Google OAuth no pudo completar el intercambio del codigo.');
      await problem(await request('callback?code=fixture-code&state=provider-state'), 400, 'OAuth state invalido o expirado.');
      assert.deepEqual(persisted, [owner, owner, owner, owner, owner, owner]);
      providerFailure = false;
    });
    await t.test('missing, invalid, non-HTTP or credential-bearing public URLs fail closed before completing OAuth', async () => {
      const before = providerCalls;
      for (const value of [undefined, '', 'not-a-url', '//evil.example', 'javascript:alert(1)', 'ftp://web.example.test', 'https://user:private-pass@web.example.test']) {
        publicWebUrl = value;
        state('config-state');
        await problem(await request('callback?code=fixture-code&state=config-state'), 503, 'La URL publica de iRec no esta configurada correctamente.');
        assert.equal(states.has('irec:storage:google-oauth:config-state'), true);
      }
      assert.equal(providerCalls, before);
    });
    await t.test('configured local HTTP origin is supported without retaining path, query or fragment', async () => {
      publicWebUrl = 'http://127.0.0.1:4200/old?token=private-config#private-fragment';
      state('local-state');
      const response = await request('callback?code=fixture-code&state=local-state');
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'http://127.0.0.1:4200/settings/storage');
    });
  } finally {
    globalThis.fetch = clientFetch;
    await app.close();
  }
});
