import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GOOGLE_DRIVE_SCOPE,
  GoogleDriveOAuthService,
} from '../src/storage/google-drive-oauth.service.js';

function config() {
  return {
    get(key: string) {
      const values: Record<string, unknown> = {
        GOOGLE_OAUTH_CLIENT_ID: 'client-id',
        GOOGLE_OAUTH_CLIENT_SECRET:
          'client-secret-for-test-only',
        GOOGLE_OAUTH_REDIRECT_URI:
          'http://127.0.0.1:3000/api/storage/google/callback',
        GOOGLE_OAUTH_STATE_TTL_SECONDS: 600,
      };

      return values[key];
    },
  };
}

function crypto() {
  return {
    randomToken() {
      return 'raw-state';
    },

    hashOpaque(value: string) {
      assert.equal(value, 'raw-state');
      return 'state-hash';
    },
  };
}

test(
  'creates bounded Google Drive authorization request',
  async () => {
    const writes: unknown[][] = [];

    const redis = {
      async connect() {},
      client: {
        async set(...args: unknown[]) {
          writes.push(args);
          return 'OK';
        },
      },
    };

    const storage = {};

    const service =
      new GoogleDriveOAuthService(
        config() as never,
        crypto() as never,
        redis as never,
        storage as never,
      );

    const result =
      await service.createAuthorizationRequest(
        'user-123',
      );

    const url = new URL(
      result.authorizationUrl,
    );

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
      url.searchParams.get(
        'include_granted_scopes',
      ),
      'true',
    );

    assert.equal(
      url.searchParams.get('state'),
      'raw-state',
    );

    assert.equal(
      result.expiresInSeconds,
      600,
    );

    assert.equal(
      writes.length,
      1,
    );

    assert.equal(
      writes[0]?.[0],
      'irec:storage:google-oauth:state-hash',
    );

    assert.equal(
      writes[0]?.[2],
      'EX',
    );

    assert.equal(
      writes[0]?.[3],
      600,
    );

    const stored = JSON.parse(
      String(writes[0]?.[1]),
    ) as {
      ownerId: string;
    };

    assert.equal(
      stored.ownerId,
      'user-123',
    );
  },
);

test(
  'consumes state once and persists only refresh credentials',
  async () => {
    let stateReads = 0;

    const redis = {
      async connect() {},

      client: {
        async call(
          command: string,
          key: string,
        ) {
          assert.equal(
            command,
            'GETDEL',
          );

          assert.equal(
            key,
            'irec:storage:google-oauth:state-hash',
          );

          stateReads += 1;

          if (stateReads > 1) {
            return null;
          }

          return JSON.stringify({
            ownerId: 'user-123',
            createdAt:
              '2026-10-01T00:00:00.000Z',
          });
        },
      },
    };

    const persisted: unknown[] = [];

    const storage = {
      async upsert(
        ownerId: string,
        input: unknown,
      ) {
        persisted.push({
          ownerId,
          input,
        });

        return {
          id: 'connection-123',
          ownerId,
          provider: 'google_drive',
          providerAccountId:
            'permission-123',
          displayName: 'Carlos',
          rootId: null,
          status: 'pending',
          lastVerifiedAt: null,
          createdAt: new Date(
            '2026-10-01T00:00:00.000Z',
          ),
          updatedAt: new Date(
            '2026-10-01T00:00:00.000Z',
          ),
        };
      },
    };

    const originalFetch =
      globalThis.fetch;

    const requests: Array<{
      url: string;
      init?: RequestInit;
    }> = [];

    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input);

      requests.push({
        url,
        init,
      });

      if (
        url ===
        'https://oauth2.googleapis.com/token'
      ) {
        const form =
          new URLSearchParams(
            String(init?.body),
          );

        assert.equal(
          form.get('code'),
          'authorization-code',
        );

        assert.equal(
          form.get('client_id'),
          'client-id',
        );

        assert.equal(
          form.get('client_secret'),
          'client-secret-for-test-only',
        );

        assert.equal(
          form.get('grant_type'),
          'authorization_code',
        );

        return new Response(
          JSON.stringify({
            access_token:
              'ephemeral-access-token',
            refresh_token:
              'long-lived-refresh-token',
            scope: GOOGLE_DRIVE_SCOPE,
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: {
              'content-type':
                'application/json',
            },
          },
        );
      }

      if (
        url.startsWith(
          'https://www.googleapis.com/drive/v3/about',
        )
      ) {
        const parsed = new URL(url);

        assert.equal(
          parsed.searchParams.get(
            'fields',
          ),
          'user(permissionId,displayName,emailAddress)',
        );

        assert.equal(
          init?.headers &&
            (
              init.headers as Record<
                string,
                string
              >
            ).authorization,
          'Bearer ephemeral-access-token',
        );

        return new Response(
          JSON.stringify({
            user: {
              permissionId:
                'permission-123',
              displayName: 'Carlos',
              emailAddress:
                'carlos@example.test',
            },
          }),
          {
            status: 200,
            headers: {
              'content-type':
                'application/json',
            },
          },
        );
      }

      throw new Error(
        `Unexpected URL: ${url}`,
      );
    }) as typeof fetch;

    try {
      const service =
        new GoogleDriveOAuthService(
          config() as never,
          crypto() as never,
          redis as never,
          storage as never,
        );

      const connection =
        await service.completeAuthorization(
          'user-123',
          'authorization-code',
          'raw-state',
        );

      assert.equal(
        connection.status,
        'pending',
      );

      assert.equal(
        persisted.length,
        1,
      );

      const persistedInput =
        persisted[0] as {
          ownerId: string;
          input: {
            provider: string;
            providerAccountId: string;
            rootId: null;
            credentialEnvelope: string;
          };
        };

      assert.equal(
        persistedInput.ownerId,
        'user-123',
      );

      assert.equal(
        persistedInput.input.provider,
        'google_drive',
      );

      assert.equal(
        persistedInput.input
          .providerAccountId,
        'permission-123',
      );

      assert.equal(
        persistedInput.input.rootId,
        null,
      );

      const envelope =
        JSON.parse(
          persistedInput.input
            .credentialEnvelope,
        ) as Record<string, unknown>;

      assert.equal(
        envelope.refreshToken,
        'long-lived-refresh-token',
      );

      assert.equal(
        envelope.scope,
        GOOGLE_DRIVE_SCOPE,
      );

      assert.equal(
        'accessToken' in envelope,
        false,
      );

      assert.equal(
        requests.length,
        2,
      );

      await assert.rejects(
        () =>
          service.completeAuthorization(
            'user-123',
            'authorization-code',
            'raw-state',
          ),
        /OAuth state invalido o expirado/,
      );

      assert.equal(
        requests.length,
        2,
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  },
);
