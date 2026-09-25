import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CreateAlbumInput,
  InviteAlbumMemberInput,
  UpdateAlbumInput,
} from '@irec/contracts';

import {
  canCreateAlbumProposal,
  canManageAlbumMembers,
  canModerateAlbumProposals,
  canReadAlbum,
  canUpdateAlbum,
  canViewAlbumMembers,
} from '../src/albums/album.policy.js';

test('CreateAlbumInput defaults visibility to private', () => {
  const parsed = CreateAlbumInput.parse({ title: 'Mi album' });
  assert.equal(parsed.visibility, 'private');
});

test('UpdateAlbumInput rejects an empty patch', () => {
  assert.equal(UpdateAlbumInput.safeParse({}).success, false);
});

test('InviteAlbumMemberInput normalizes email', () => {
  const parsed = InviteAlbumMemberInput.parse({ email: '  PERSONA@Example.COM ' });
  assert.equal(parsed.email, 'persona@example.com');
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

test('owner and active members may view membership roster', () => {
  assert.equal(canViewAlbumMembers('owner', 'owner', false), true);
  assert.equal(canViewAlbumMembers('owner', 'member', true), true);
  assert.equal(canViewAlbumMembers('owner', 'outsider', false), false);
});

test('only owner may manage memberships', () => {
  assert.equal(canManageAlbumMembers('owner', 'owner'), true);
  assert.equal(canManageAlbumMembers('owner', 'member'), false);
});


test('only active non-owner members may create proposals', () => {
  assert.equal(canCreateAlbumProposal('owner', 'member', true), true);
  assert.equal(canCreateAlbumProposal('owner', 'member', false), false);
  assert.equal(canCreateAlbumProposal('owner', 'owner', true), false);
});

test('only owner may moderate proposals', () => {
  assert.equal(canModerateAlbumProposals('owner', 'owner'), true);
  assert.equal(canModerateAlbumProposals('owner', 'member'), false);
});
