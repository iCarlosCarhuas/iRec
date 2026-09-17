import assert from 'node:assert/strict';
import test from 'node:test';

import { CreateAlbumInput, UpdateAlbumInput } from '@irec/contracts';

import { canReadAlbum, canUpdateAlbum } from '../src/albums/album.policy.js';

test('CreateAlbumInput defaults visibility to private', () => {
  const parsed = CreateAlbumInput.parse({ title: 'Mi album' });
  assert.equal(parsed.visibility, 'private');
});

test('UpdateAlbumInput rejects an empty patch', () => {
  assert.equal(UpdateAlbumInput.safeParse({}).success, false);
});

test('public album is readable anonymously', () => {
  assert.equal(
    canReadAlbum({
      visibility: 'public',
      ownerId: 'owner',
      hasActiveMembership: false,
    }),
    true,
  );
});

test('private album is hidden from anonymous/non-member viewers', () => {
  assert.equal(
    canReadAlbum({
      visibility: 'private',
      ownerId: 'owner',
      hasActiveMembership: false,
    }),
    false,
  );

  assert.equal(
    canReadAlbum({
      visibility: 'private',
      ownerId: 'owner',
      viewerId: 'other',
      hasActiveMembership: false,
    }),
    false,
  );
});

test('private album is readable by owner or active member', () => {
  assert.equal(
    canReadAlbum({
      visibility: 'private',
      ownerId: 'owner',
      viewerId: 'owner',
      hasActiveMembership: false,
    }),
    true,
  );

  assert.equal(
    canReadAlbum({
      visibility: 'private',
      ownerId: 'owner',
      viewerId: 'member',
      hasActiveMembership: true,
    }),
    true,
  );
});

test('only owner may update an album', () => {
  assert.equal(canUpdateAlbum('owner', 'owner'), true);
  assert.equal(canUpdateAlbum('owner', 'member'), false);
});
