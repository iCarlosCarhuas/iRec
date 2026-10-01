import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GOOGLE_DRIVE_SCOPE,
  GoogleDriveOAuthService,
} from '../src/storage/google-drive-oauth.service.js';

test('creates bounded Google Drive authorization request', async () => {
  const writes: unknown[][] = [];

  const config = {
    get(key: string) {
      const values: Record<string, unknown> = {
        GOOGLE_OAUTH_CLIENT_ID: 'client-id',
        GOOGLE_OAUTH_REDIRECT_URI:
          'http://127.0.0.1:3000/api/storage/google/callback',
        GOOGLE_OAUTH_STATE_TTL_SECONDS: 600,
      };

      return values[key];
    },
  };

  const crypto = {
    randomToken() {
      return 'raw-state';
    },

    hashOpaque(value: string) {
      assert.equal(value, 'raw-state');
      return 'state-hash';
    },
  };

  const redis = {
    async connect() {},
    client: {
      async set(...args: unknown[]) {
        writes.push(args);
        return 'OK';
      },
    },
  };

  const service = new GoogleDriveOAuthService(
    config as never,
    crypto as never,
    redis as never,
  );

  const result = await service.createAuthorizationRequest(
    'user-123',
  );

  const url = new URL(result.authorizationUrl);

  assert.equal(
    url.origin + url.pathname,
    'https://accounts.google.com/o/oauth2/v2/auth',
  );

  assert.equal(
    url.searchParams.get('client_id'),
    'client-id',
  );

  assert.equal(
    url.searchParams.get('scope'),
    GOOGLE_DRIVE_SCOPE,
  );

  assert.equal(
    url.searchParams.get('response_type'),
    'code',
  );

  assert.equal(
    url.searchParams.get('access_type'),
    'offline',
  );

  assert.equal(
    url.searchParams.get('include_granted_scopes'),
    'true',
  );

  assert.equal(
    url.searchParams.get('state'),
    'raw-state',
  );

  assert.equal(result.expiresInSeconds, 600);

  assert.equal(writes.length, 1);

  assert.equal(
    writes[0]?.[0],
    'irec:storage:google-oauth:state-hash',
  );

  assert.equal(writes[0]?.[2], 'EX');
  assert.equal(writes[0]?.[3], 600);

  const stored = JSON.parse(
    String(writes[0]?.[1]),
  ) as {
    ownerId: string;
  };

  assert.equal(stored.ownerId, 'user-123');
});
