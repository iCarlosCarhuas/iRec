import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Generator } from '@angular/service-worker/config';

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    throw new Error(`Cannot read JSON from ${path}`, { cause });
  }
}

const webRoot = new URL('../', import.meta.url);
const config = await readJson(new URL('ngsw-config.json', webRoot));
const page = await readFile(new URL('src/app/features/storage/storage.page.ts', webRoot), 'utf8');

// Use the installed Angular generator, not a second implementation of its globs.
const files = ['/index.html', '/main.js', '/styles.css', '/favicon.ico',
  '/manifest.webmanifest', '/icons/icon-192.png'];
const generator = new Generator({
  list: async () => files,
  hash: async () => 'fixture-hash',
  read: async () => '',
}, '/');
const { navigationUrls: _navigationUrls, ...defaultConfig } = config;
const defaults = await generator.process(defaultConfig);
const generated = await generator.process(config);
const apiExclusion = await generator.process({ ...config, navigationUrls: ['!/api/**'] });
const expectedRules = [...defaults.navigationUrls, ...apiExclusion.navigationUrls];

function checkNavigation(manifest, label) {
  assert.deepEqual(manifest.navigationUrls, expectedRules,
    `${label}: preserve installed Angular defaults and append !/api/**`);
  const matches = (path) => manifest.navigationUrls.some(({ positive, regex }) =>
    positive && new RegExp(regex).test(path)) && !manifest.navigationUrls.some(({ positive, regex }) =>
    !positive && new RegExp(regex).test(path));
  for (const path of ['/api/storage/google/connect', '/api/storage/google/callback',
    '/api/storage/connections', '/api/', '/api/other/nested']) {
    assert.equal(matches(path), false, `${label}: exclude ${path}`);
  }
  for (const path of ['/', '/settings/storage', '/settings/storage?google=connected', '/apiary']) {
    assert.equal(matches(path), true, `${label}: keep app navigation ${path}`);
  }
  for (const path of ['/main.js', '/styles.css', '/icons/icon-192.png', '/file.json',
    '/settings/internal__value', '/settings/internal__/child']) {
    assert.equal(matches(path), false, `${label}: keep default exclusion ${path}`);
  }
}

checkNavigation(generated, 'Config generation');
assert.deepEqual(generated.assetGroups, defaults.assetGroups, 'Asset caching must remain unchanged');
assert.deepEqual(generated.assetGroups[0].urls, [...files].sort(), 'App assets stay cached');

// Source-level guard: navigation remains same-origin and keeps the backend redirect contract.
const assignment = page.match(/window\.location\.assign\('([^']+)'\)/);
assert.ok(assignment, 'OAuth start must remain a literal backend navigation');
const connect = new URL(assignment[1], 'https://irec.invalid');
assert.equal(connect.origin, 'https://irec.invalid');
assert.equal(connect.pathname, '/api/storage/google/connect');
assert.deepEqual([...connect.searchParams], [['ngsw-bypass', 'true']],
  'OAuth start must bypass already-installed service workers');
assert.equal(connect.hash, '');

const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--manifest'),
  'Usage: node scripts/check-service-worker.mjs [--manifest path/to/ngsw.json]');
if (args.length) {
  const manifest = await readJson(args[1]);
  checkNavigation(manifest, 'Built manifest');
  console.log('Built navigation rules:', JSON.stringify(manifest.navigationUrls));
}
console.log('Service-worker navigation and OAuth bypass checks passed.');
