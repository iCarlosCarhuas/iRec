import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { GOOGLE_DRIVE_SCOPE } from '../src/storage/google-drive-oauth.service.js';
import { GoogleDriveRootService } from '../src/storage/google-drive-root.service.js';
import { StorageConnectionService } from '../src/storage/storage-connection.service.js';

const envelope = JSON.stringify({ version: 1, refreshToken: 'fixture-refresh', scope: GOOGLE_DRIVE_SCOPE, tokenType: 'Bearer' });
const token = { access_token: 'fixture-access', token_type: 'Bearer', expires_in: 3600 };
const folder = {
  id: 'managed-root', name: 'iRec', mimeType: 'application/vnd.google-apps.folder', trashed: false,
  appProperties: { irecRoot: 'v1' }, capabilities: { canAddChildren: true },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Handler = (url: URL, init: RequestInit) => Promise<Response> | Response;

// Model row-lock serialization/rollback without a live DB. SQL lock/predicates
// are asserted here; PostgreSQL's runtime behavior remains an integration gate.
function fixture(rootId: string | null = null, status = 'pending', lastVerifiedAt: Date | null = null) {
  let row = {
    id: 'connection', ownerId: 'owner', provider: 'google_drive', providerAccountId: 'account',
    displayName: null, rootId, status, credentialsEncrypted: 'fixture-ciphertext',
    lastVerifiedAt, createdAt: new Date(), updatedAt: new Date(),
  };
  let queue = Promise.resolve();
  let failPersistence = false;
  let decrypts = 0;
  const writes: Record<string, unknown>[] = [];
  async function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  const db = {
    // Non-locking recheck read backing StorageConnectionService.getOwned.
    select() {
      let matches = false;
      const chain = {
        from() { return chain; },
        where(predicate: SQL) {
          const query = new PgDialect().sqlToQuery(predicate);
          matches = query.params[0] === row.id && query.params[1] === row.ownerId;
          return chain;
        },
        async limit() { return matches ? [{ ...row }] : []; },
      };
      return chain;
    },
    async transaction(operation: (tx: unknown) => Promise<unknown>) {
      return serialized(async () => {
        let matches = false;
        let update: Record<string, unknown> = {};
        const tx = {
          select() { return this; }, from() { return this; }, limit() { return this; },
          where(predicate: SQL) {
            const query = new PgDialect().sqlToQuery(predicate);
            assert.match(query.sql, /"owner_id"/);
            assert.match(query.sql, /"provider"/);
            matches = query.params[0] === row.id && query.params[1] === row.ownerId && query.params[2] === row.provider;
            return this;
          },
          async for(mode: string) { assert.equal(mode, 'update'); return matches ? [{ ...row }] : []; },
          update() { return this; },
          set(value: Record<string, unknown>) { update = value; return this; },
          async returning() {
            if (failPersistence) { failPersistence = false; throw new Error('fixture database detail'); }
            assert.ok(matches);
            writes.push(update);
            row = { ...row, ...update };
            return [{ ...row }];
          },
        };
        return operation(tx);
      });
    },
    insert() {
      let values: Record<string, unknown> = {};
      let conflict: Record<string, unknown> = {};
      return {
        values(input: Record<string, unknown>) { values = input; return this; },
        onConflictDoUpdate(input: { set: Record<string, unknown> }) { conflict = input.set; return this; },
        async returning() {
          return serialized(async () => {
            assert.equal(values.ownerId, row.ownerId);
            assert.equal(values.providerAccountId, row.providerAccountId);
            row = { ...row, ...conflict, rootId: typeof conflict.rootId === 'string' ? conflict.rootId : row.rootId };
            return [{ ...row }];
          });
        },
      };
    },
  };
  const storage = new StorageConnectionService({ db } as never, {
    decrypt() { decrypts++; return envelope; }, encrypt: () => 'fixture-refreshed-ciphertext',
  } as never);
  const config = { get: (key: string) => key === 'GOOGLE_OAUTH_CLIENT_ID' ? 'fixture-client' : 'fixture-client-secret' };
  return {
    storage, service: new GoogleDriveRootService(config as never, storage),
    secondService: new GoogleDriveRootService(config as never, storage),
    row: () => row, decrypts: () => decrypts, writes,
    failPersistence: () => { failPersistence = true; },
  };
}

async function withProvider(handler: Handler, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    if (url.hostname === 'oauth2.googleapis.com') {
      const form = new URLSearchParams(String(init?.body));
      assert.equal(form.get('grant_type'), 'refresh_token');
      assert.equal(form.get('refresh_token'), 'fixture-refresh');
      assert.equal(init?.method, 'POST');
      return handler(url, init!) ;
    }
    assert.equal(url.hostname, 'www.googleapis.com');
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer fixture-access');
    return handler(url, init!);
  }) as typeof fetch;
  try { await run(); } finally { globalThis.fetch = original; }
}

function tokenOr(url: URL, response: () => Response) {
  return url.hostname === 'oauth2.googleapis.com' ? json(token) : response();
}

async function sanitizedFailure(operation: () => Promise<unknown>, status: number, message: string) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), status);
    assert.match(error.message, new RegExp(message));
    assert.doesNotMatch(JSON.stringify(error.getResponse()), /fixture-|provider-secret|database detail/);
    return true;
  });
}

test('looks up only marked iRec folders; creates marked root and persists no access token', async () => {
  const f = fixture();
  let creates = 0;
  await withProvider((url, init) => tokenOr(url, () => {
    if (init.method === 'POST') {
      creates++;
      assert.deepEqual(JSON.parse(String(init.body)), {
        name: folder.name, mimeType: folder.mimeType, appProperties: folder.appProperties,
      });
      return json(folder);
    }
    assert.match(url.searchParams.get('q')!, /trashed = false/);
    assert.match(url.searchParams.get('q')!, /name = 'iRec'/);
    assert.match(url.searchParams.get('q')!, /mimeType = 'application\/vnd.google-apps.folder'/);
    assert.match(url.searchParams.get('q')!, /key='irecRoot' and value='v1'/);
    return json({ files: [] });
  }), async () => {
    const result = await f.service.prepareRoot('connection', 'owner');
    assert.equal(result.rootId, folder.id);
    assert.equal(result.status, 'ready');
    assert.ok(result.lastVerifiedAt instanceof Date);
    assert.equal('credentialsEncrypted' in result, false);
    assert.doesNotMatch(JSON.stringify([result, f.writes]), /fixture-access|fixture-refresh/);
    assert.equal(f.row().credentialsEncrypted, 'fixture-ciphertext');
    assert.equal(creates, 1);
  });
});

test('revalidates a stale ready marked root even if renamed, without lookup/create', async () => {
  const f = fixture(folder.id, 'ready', new Date(0));
  let gets = 0;
  await withProvider((url) => tokenOr(url, () => {
    assert.equal(url.pathname, `/drive/v3/files/${folder.id}`);
    gets++;
    return json({ ...folder, name: 'My renamed root' });
  }), async () => {
    const result = await f.service.prepareRoot('connection', 'owner');
    assert.equal(result.rootId, folder.id);
    assert.equal(gets, 1);
    assert.equal(f.writes.length, 1);
  });
});

test('returns a freshly verified root without decrypting credentials or contacting Google', async () => {
  const f = fixture(folder.id, 'ready', new Date());
  await withProvider(() => { throw new Error('Provider must not be contacted'); }, async () => {
    const result = await f.service.prepareRoot('connection', 'owner');
    assert.equal(result.rootId, folder.id);
    assert.equal(result.status, 'ready');
    assert.equal(f.decrypts(), 0);
    assert.equal(f.writes.length, 0);
  });
});

test('a stale verification still revalidates against the provider', async () => {
  const f = fixture(folder.id, 'ready', new Date(0));
  await withProvider((url) => tokenOr(url, () => {
    assert.equal(url.pathname, `/drive/v3/files/${folder.id}`);
    return json({ ...folder, name: 'My renamed root' });
  }), async () => {
    const result = await f.service.prepareRoot('connection', 'owner');
    assert.equal(result.rootId, folder.id);
    assert.equal(f.writes.length, 1);
  });
});

for (const [name, stale] of [
  ['missing', () => json({ error: 'provider-secret' }, 404)],
  ['trashed', () => json({ ...folder, trashed: true })],
  ['unmarked user folder', () => json({ ...folder, appProperties: {} })],
  ['wrong marker', () => json({ ...folder, appProperties: { irecRoot: 'other' } })],
  ['non-folder', () => json({ ...folder, mimeType: 'text/plain' })],
] as const) {
  test(`recovers ${name} root by marker lookup without mutating the stale folder`, async () => {
    const f = fixture(folder.id, 'ready');
    await withProvider((url, init) => tokenOr(url, () => {
      assert.equal(init.method, undefined);
      if (url.pathname.endsWith(`/${folder.id}`)) return stale();
      return json({ files: [{ ...folder, id: 'replacement' }] });
    }), async () => {
      const result = await f.service.prepareRoot('connection', 'owner');
      assert.equal(result.rootId, 'replacement');
    });
  });
}

test('paginates marker search before creating, and ignores unmarked namesakes', async () => {
  const f = fixture();
  await withProvider((url, init) => tokenOr(url, () => {
    assert.notEqual(init.method, 'POST');
    return url.searchParams.has('pageToken') ? json({ files: [folder] }) :
      json({ files: [{ ...folder, id: 'user-folder', appProperties: {} }], nextPageToken: 'page-two' });
  }), async () => { assert.equal((await f.service.prepareRoot('connection', 'owner')).rootId, folder.id); });
});

for (const status of [403, 429, 503]) {
  test(`stored-root ${status} is not mistaken for absence`, async () => {
    const f = fixture(folder.id, 'ready');
    await withProvider((url) => tokenOr(url, () => {
      assert.equal(url.pathname, `/drive/v3/files/${folder.id}`);
      return json({ error: 'provider-secret' }, status);
    }), async () => {
      await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), status === 403 ? 403 : 503,
        status === 403 ? 'permissions' : 'unavailable');
      assert.equal(f.writes.length, 0);
    });
  });
}

test('rejects a managed root without write permission rather than creating another', async () => {
  const f = fixture(folder.id);
  await withProvider((url) => tokenOr(url, () => json({ ...folder, capabilities: { canAddChildren: false } })), async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 403, 'permissions');
    assert.equal(f.writes.length, 0);
  });
});

test('owner/provider mismatch cannot decrypt credentials or contact Google', async () => {
  const f = fixture();
  await withProvider(() => { throw new Error('Provider must not be contacted'); }, async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'other-owner'), 404, 'not found');
    f.row().provider = 'other-provider';
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 404, 'not found');
    assert.equal(f.decrypts(), 0);
  });
});

test('revoked credentials and transport failures are sanitized', async () => {
  const f = fixture();
  await withProvider(() => json({ error: 'invalid_grant', error_description: 'provider-secret' }, 400), async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 401, 'reconnect');
  });
  await withProvider(() => { throw new Error('provider-secret'); }, async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 503, 'unavailable');
  });
  assert.equal(f.writes.length, 0);
});

for (const [name, handler] of [
  ['malformed token', () => json({ access_token: 'fixture-access' })],
  ['invalid JSON', () => new Response('provider-secret', { status: 200 })],
  ['bad lookup', (url: URL) => tokenOr(url, () => json({ files: 'provider-secret' }))],
  ['bad metadata', (url: URL) => tokenOr(url, () => json({ files: [{ id: 'provider-secret' }] }))],
  ['incomplete pagination', (url: URL) => tokenOr(url, () => json({ files: [], nextPageToken: 'same-page' }))],
  ['unmarked create response', (url: URL, init: RequestInit) => tokenOr(url, () =>
    init.method === 'POST' ? json({ ...folder, appProperties: {} }) : json({ files: [] }))],
] as const) {
  test(`fails closed on ${name}`, async () => {
    const f = fixture();
    await withProvider(handler, async () => {
      await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 502, 'invalid response');
      assert.equal(f.writes.length, 0);
    });
  });
}

test('retries persistence failure by finding the remotely created marker, not creating twice', async () => {
  const f = fixture();
  let created = false;
  let creates = 0;
  f.failPersistence();
  await withProvider((url, init) => tokenOr(url, () => {
    if (init.method === 'POST') { created = true; creates++; return json(folder); }
    return json({ files: created ? [folder] : [] });
  }), async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 503, 'could not be completed');
    assert.equal(f.row().rootId, null);
    assert.equal(f.row().status, 'pending');
    assert.equal((await f.service.prepareRoot('connection', 'owner')).rootId, folder.id);
    assert.equal(creates, 1);
  });
});

test('pagination uses the remaining shared deadline and awaits cancellation before releasing the lock', async (t) => {
  const f = fixture();
  const controller = new AbortController();
  const originalTimeout = AbortSignal.timeout;
  const requestTimeouts: number[] = [];
  let now = 0;
  let cancelled = false;
  t.mock.method(performance, 'now', () => now);
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    if (ms === 30_000) return controller.signal;
    requestTimeouts.push(ms);
    return originalTimeout(ms);
  });
  await withProvider(async (url, init) => {
    if (url.hostname === 'oauth2.googleapis.com') return json(token);
    assert.notEqual(init.method, 'POST');
    if (!url.searchParams.has('pageToken')) {
      now = 29_500;
      return json({ files: [], nextPageToken: 'second-page' });
    }
    return new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => {
        cancelled = true;
        reject(new Error('provider-secret'));
      }, { once: true });
      controller.abort();
    });
  }, async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 503, 'unavailable');
    assert.equal(cancelled, true);
    assert.deepEqual(requestTimeouts, [10_000, 10_000, 500]);
    assert.equal(f.writes.length, 0);
  });
  t.mock.restoreAll();
  // Failure has settled and released the serialized transaction for a retry.
  await withProvider((url) => tokenOr(url, () => json({ files: [folder] })), async () => {
    assert.equal((await f.secondService.prepareRoot('connection', 'owner')).status, 'ready');
  });
});

test('deadline exhaustion between pages fails closed without another request or create', async (t) => {
  const f = fixture();
  let now = 0;
  let pages = 0;
  t.mock.method(performance, 'now', () => now);
  await withProvider((url, init) => tokenOr(url, () => {
    assert.notEqual(init.method, 'POST');
    pages++;
    now = 30_001;
    return json({ files: [], nextPageToken: 'unread-page' });
  }), async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 503, 'unavailable');
    assert.equal(pages, 1);
    assert.equal(f.writes.length, 0);
  });
});

test('shared deadline cancels stalled response body consumption without persisting ready', async (t) => {
  const f = fixture(folder.id, 'ready');
  const controller = new AbortController();
  const originalTimeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, 'timeout', (ms: number) =>
    ms === 30_000 ? controller.signal : originalTimeout(ms));
  let bodyCancelled = false;
  await withProvider((url, init) => {
    if (url.hostname === 'oauth2.googleapis.com') return json(token);
    return new Response(new ReadableStream({
      start(stream) {
        init.signal!.addEventListener('abort', () => {
          bodyCancelled = true;
          stream.error(new Error('provider-secret'));
        }, { once: true });
        // Allow headers to resolve and JSON consumption to begin before aborting.
        setTimeout(() => controller.abort(), 5);
      },
    }));
  }, async () => {
    await sanitizedFailure(() => f.service.prepareRoot('connection', 'owner'), 503, 'unavailable');
    assert.equal(bodyCancelled, true);
    assert.equal(f.writes.length, 0);
    assert.equal(f.row().status, 'ready'); // Historical state, not a health verdict.
  });
});

test('concurrent service instances serialize lookup/create/persist, and reconnect retains the root', async () => {
  const f = fixture();
  let creates = 0;
  await withProvider((url, init) => tokenOr(url, () => {
    if (init.method === 'POST') { creates++; return json(folder); }
    return json(url.pathname.endsWith(`/${folder.id}`) ? folder : { files: [] });
  }), async () => {
    const first = f.service.prepareRoot('connection', 'owner');
    const second = f.secondService.prepareRoot('connection', 'owner');
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.rootId, folder.id);
    assert.equal(b.rootId, folder.id);
    const reconnected = await f.storage.upsert('owner', {
      provider: 'google_drive', providerAccountId: 'account', rootId: null, credentialEnvelope: envelope,
    });
    assert.equal(reconnected.rootId, folder.id);
    assert.equal(reconnected.status, 'pending');
    assert.equal(reconnected.lastVerifiedAt, null);
    assert.equal(creates, 1);
    assert.equal(f.row().credentialsEncrypted, 'fixture-refreshed-ciphertext');
    assert.equal((await f.service.prepareRoot('connection', 'owner')).status, 'ready');
    assert.equal(creates, 1);
  });
});
