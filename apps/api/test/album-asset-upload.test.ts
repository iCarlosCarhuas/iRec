import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALBUM_ASSET_UPLOAD_MAX_BYTES,
  PresignAlbumAssetInput,
  SetAlbumStorageConnectionInput,
} from '@irec/contracts';

import {
  buildAlbumAssetObjectKey,
  completedUploadMatches,
  PHOTO_UPLOAD_INTENT_TTL_SECONDS,
  PHOTO_UPLOAD_PRESIGN_TTL_SECONDS,
} from '../src/albums/album-asset-upload.policy.js';

const albumId = '11111111-1111-4111-8111-111111111111';
const assetId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333';

test('presign input accepts supported image metadata', () => {
  const parsed = PresignAlbumAssetInput.parse({
    originalFilename: 'foto.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 4_000_000,
  });

  assert.equal(parsed.mimeType, 'image/jpeg');
  assert.equal(parsed.sizeBytes, 4_000_000);
});

test('presign input rejects unsupported mime and oversized files', () => {
  assert.equal(
    PresignAlbumAssetInput.safeParse({
      originalFilename: 'foto.gif',
      mimeType: 'image/gif',
      sizeBytes: 10,
    }).success,
    false,
  );

  assert.equal(
    PresignAlbumAssetInput.safeParse({
      originalFilename: 'foto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: ALBUM_ASSET_UPLOAD_MAX_BYTES + 1,
    }).success,
    false,
  );
});

test('object key is backend-controlled and tied to reserved asset id', () => {
  assert.equal(
    buildAlbumAssetObjectKey(albumId, assetId, 'image/jpeg'),
    `albums/${albumId}/originals/${assetId}.jpg`,
  );
  assert.equal(
    buildAlbumAssetObjectKey(albumId, assetId, 'image/webp'),
    `albums/${albumId}/originals/${assetId}.webp`,
  );
});

test('completion requires exact content type and byte length', () => {
  assert.equal(
    completedUploadMatches(
      { mimeType: 'image/png', sizeBytes: 1234 },
      { contentType: 'image/png', sizeBytes: 1234 },
    ),
    true,
  );
  assert.equal(
    completedUploadMatches(
      { mimeType: 'image/png', sizeBytes: 1234 },
      { contentType: 'image/jpeg', sizeBytes: 1234 },
    ),
    false,
  );
  assert.equal(
    completedUploadMatches(
      { mimeType: 'image/png', sizeBytes: 1234 },
      { contentType: 'image/png', sizeBytes: 999 },
    ),
    false,
  );
});

test('presigned URL expires before the Redis completion intent', () => {
  assert.ok(PHOTO_UPLOAD_PRESIGN_TTL_SECONDS > 0);
  assert.ok(
    PHOTO_UPLOAD_INTENT_TTL_SECONDS > PHOTO_UPLOAD_PRESIGN_TTL_SECONDS,
  );
});

test('album storage binding accepts owned connection id or detach null', () => {
  assert.equal(
    SetAlbumStorageConnectionInput.parse({
      storageConnectionId: connectionId,
    }).storageConnectionId,
    connectionId,
  );
  assert.equal(
    SetAlbumStorageConnectionInput.parse({
      storageConnectionId: null,
    }).storageConnectionId,
    null,
  );
});
