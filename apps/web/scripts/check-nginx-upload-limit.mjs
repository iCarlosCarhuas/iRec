import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Regression guard for the browser-proven 413: nginx default
// client_max_body_size (~1MB) rejects 100MB uploads as HTML before the API
// can answer JSON. The config must keep a 110M budget (100MB app limit +
// multipart overhead) at server level and on the /api/ location.
const nginxConf = await readFile(new URL('../nginx.conf', import.meta.url), 'utf8');

const limits = [...nginxConf.matchAll(/client_max_body_size\s+([^;]+);/g)].map((match) =>
  match[1].trim(),
);
assert.ok(
  limits.length >= 2,
  `expected client_max_body_size at server and /api/ location, found: ${limits.join(', ') || 'none'}`,
);
for (const limit of limits) {
  assert.equal(limit, '110M', `upload budget must stay 110M, found ${limit}`);
}

const apiBlock = nginxConf.match(/location\s+\/api\/\s*\{[^}]*\}/s)?.[0] ?? '';
assert.match(
  apiBlock,
  /client_max_body_size\s+110M;/,
  'the /api/ location must carry the 110M upload budget',
);
assert.match(
  nginxConf,
  /100MB app.*multipart overhead/i,
  'the budget comment must explain the 100MB + overhead rationale',
);

console.log(`nginx upload budget OK — ${limits.length}x client_max_body_size 110M.`);
