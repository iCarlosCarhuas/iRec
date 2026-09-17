import {
  index as irecIndex,
  pgEnum as irecPgEnum,
  pgTable as irecPgTable,
  primaryKey as irecPrimaryKey,
  text as irecText,
  timestamp as irecTimestamp,
  uuid as irecUuid,
  varchar as irecVarchar,
} from 'drizzle-orm/pg-core';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  bigint,
} from 'drizzle-orm/pg-core';

export const emailTokenPurpose = pgEnum('email_token_purpose', [
  'VERIFY_EMAIL',
  'RECOVER_TOTP',
]);

export const totpCredentialStatus = pgEnum('totp_credential_status', [
  'PENDING',
  'ACTIVE',
  'REVOKED',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('users_email_uq').on(table.email),
]);

export const emailTokens = pgTable('email_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: emailTokenPurpose('purpose').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('email_tokens_hash_uq').on(table.tokenHash),
  index('email_tokens_user_purpose_idx').on(table.userId, table.purpose),
]);

export const totpCredentials = pgTable('totp_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: totpCredentialStatus('status').notNull(),
  secretEncrypted: text('secret_encrypted').notNull(),
  lastTimeStep: bigint('last_time_step', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  index('totp_credentials_user_status_idx').on(table.userId, table.status),
]);

export const recoveryCodes = pgTable('recovery_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('recovery_codes_user_idx').on(table.userId),
  uniqueIndex('recovery_codes_hash_uq').on(table.codeHash),
]);

export const trustedDevices = pgTable('trusted_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('trusted_devices_token_hash_uq').on(table.tokenHash),
  index('trusted_devices_user_idx').on(table.userId),
]);


// -----------------------------------------------------------------------------
// iRec v0.3.0 - Album Core / AD-1
// -----------------------------------------------------------------------------

export const albumVisibilityEnum = irecPgEnum('album_visibility', [
  'public',
  'private',
]);

export const albumMemberRoleEnum = irecPgEnum('album_member_role', [
  'owner',
  'member',
]);

export const albumMemberStatusEnum = irecPgEnum('album_member_status', [
  'active',
  'invited',
  'removed',
]);

export const albums = irecPgTable(
  'albums',
  {
    id: irecUuid('id').defaultRandom().primaryKey(),
    ownerId: irecUuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: irecVarchar('title', { length: 160 }).notNull(),
    description: irecText('description'),
    visibility: albumVisibilityEnum('visibility').notNull().default('private'),
    createdAt: irecTimestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: irecTimestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    irecIndex('albums_owner_idx').on(table.ownerId),
    irecIndex('albums_visibility_idx').on(table.visibility),
  ],
);

export const albumMembers = irecPgTable(
  'album_members',
  {
    albumId: irecUuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    userId: irecUuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: albumMemberRoleEnum('role').notNull().default('member'),
    status: albumMemberStatusEnum('status').notNull().default('active'),
    joinedAt: irecTimestamp('joined_at', { withTimezone: true }),
    createdAt: irecTimestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: irecTimestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    irecPrimaryKey({ columns: [table.albumId, table.userId] }),
    irecIndex('album_members_user_status_idx').on(table.userId, table.status),
    irecIndex('album_members_album_role_idx').on(table.albumId, table.role),
  ],
);

// Application invariant for AD-1:
// every album owner must also have exactly one ACTIVE OWNER membership.
// The service layer will enforce this atomically when album creation is added.
// owner_id remains on albums for ownership queries and referential clarity.

