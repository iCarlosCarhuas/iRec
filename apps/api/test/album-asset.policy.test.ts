import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canModerateAlbumAssets,
  canSeeAlbumAsset,
  initialAlbumAssetStatus,
} from '../src/albums/album-assets.policy.js';

test('owner uploads are approved immediately', () => {
  assert.equal(
    initialAlbumAssetStatus('owner', 'owner', true),
    'approved',
  );
});

test('active member uploads are pending', () => {
  assert.equal(
    initialAlbumAssetStatus('owner', 'member', true),
    'pending',
  );
});

test('outsiders cannot register album assets', () => {
  assert.equal(
    initialAlbumAssetStatus('owner', 'outsider', false),
    null,
  );
});

test('only owner may moderate album assets', () => {
  assert.equal(canModerateAlbumAssets('owner', 'owner'), true);
  assert.equal(canModerateAlbumAssets('owner', 'member'), false);
});

test('approved assets are visible to an allowed viewer', () => {
  assert.equal(
    canSeeAlbumAsset('approved', 'owner', 'member', undefined, false),
    true,
  );
});

test('active members may see their own pending/rejected assets', () => {
  assert.equal(
    canSeeAlbumAsset('pending', 'owner', 'member', 'member', true),
    true,
  );
  assert.equal(
    canSeeAlbumAsset('rejected', 'owner', 'member', 'member', true),
    true,
  );
  assert.equal(
    canSeeAlbumAsset('pending', 'owner', 'member', 'other', true),
    false,
  );
});
