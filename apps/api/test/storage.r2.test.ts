import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildR2Endpoint,
  classifyR2Failure,
} from '../src/storage/r2-verifier.service.js';

test('buildR2Endpoint uses the Cloudflare account S3 endpoint', () => {
  assert.equal(
    buildR2Endpoint('0123456789abcdef0123456789abcdef'),
    'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
  );
});

test('classifyR2Failure treats 4xx responses as credential/bucket failures', () => {
  assert.equal(
    classifyR2Failure({ $metadata: { httpStatusCode: 403 } }),
    'client',
  );
  assert.equal(
    classifyR2Failure({ $metadata: { httpStatusCode: 404 } }),
    'client',
  );
});

test('classifyR2Failure treats 5xx and transport failures as upstream failures', () => {
  assert.equal(
    classifyR2Failure({ $metadata: { httpStatusCode: 503 } }),
    'upstream',
  );
  assert.equal(classifyR2Failure(new Error('network')), 'upstream');
});
