import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service.js';
import { storageConnections } from '../database/schema.js';
import { CryptoService } from '../security/crypto.service.js';

import type { StorageConnection } from './storage-connection.js';
import type {
  StorageConnectionStatus,
  StorageProviderType,
} from './storage-provider.js';

export interface CreateStorageConnectionInput {
  provider: StorageProviderType;
  providerAccountId: string;
  displayName?: string | null;
  rootId?: string | null;

  /**
   * Provider-specific credential envelope.
   *
   * This value is encrypted before persistence and must never be returned
   * through public contracts.
   */
  credentialEnvelope: string;
}

@Injectable()
export class StorageConnectionService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}

  async create(
    ownerId: string,
    input: CreateStorageConnectionInput,
  ): Promise<StorageConnection> {
    const [row] = await this.dbs.db
      .insert(storageConnections)
      .values({
        ownerId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        displayName: input.displayName ?? null,
        rootId: input.rootId ?? null,
        credentialsEncrypted: this.crypto.encrypt(
          input.credentialEnvelope,
        ),
        status: 'pending',
      })
      .returning();

    if (!row) {
      throw new Error(
        'Storage connection could not be created',
      );
    }

    return this.toDomain(row);
  }

  async upsert(
    ownerId: string,
    input: CreateStorageConnectionInput,
  ): Promise<StorageConnection> {
    const now = new Date();

    const credentialsEncrypted = this.crypto.encrypt(
      input.credentialEnvelope,
    );

    const [row] = await this.dbs.db
      .insert(storageConnections)
      .values({
        ownerId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        displayName: input.displayName ?? null,
        rootId: input.rootId ?? null,
        credentialsEncrypted,
        status: 'pending',
        lastVerifiedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          storageConnections.ownerId,
          storageConnections.provider,
          storageConnections.providerAccountId,
        ],
        set: {
          displayName: input.displayName ?? null,
          rootId: input.rootId ?? null,
          credentialsEncrypted,
          status: 'pending',
          lastVerifiedAt: null,
          updatedAt: now,
        },
      })
      .returning();

    if (!row) {
      throw new Error(
        'Storage connection could not be persisted',
      );
    }

    return this.toDomain(row);
  }

  async listOwned(
    ownerId: string,
  ): Promise<StorageConnection[]> {
    const rows = await this.dbs.db
      .select()
      .from(storageConnections)
      .where(eq(storageConnections.ownerId, ownerId));

    return rows.map((row) => this.toDomain(row));
  }

  async getOwned(
    connectionId: string,
    ownerId: string,
  ): Promise<StorageConnection | null> {
    const [row] = await this.dbs.db
      .select()
      .from(storageConnections)
      .where(
        and(
          eq(storageConnections.id, connectionId),
          eq(storageConnections.ownerId, ownerId),
        ),
      )
      .limit(1);

    return row ? this.toDomain(row) : null;
  }

  async getCredentialEnvelope(
    connectionId: string,
    ownerId: string,
  ): Promise<string | null> {
    const [row] = await this.dbs.db
      .select({
        credentialsEncrypted:
          storageConnections.credentialsEncrypted,
      })
      .from(storageConnections)
      .where(
        and(
          eq(storageConnections.id, connectionId),
          eq(storageConnections.ownerId, ownerId),
        ),
      )
      .limit(1);

    if (!row) return null;

    return this.crypto.decrypt(
      row.credentialsEncrypted,
    );
  }

  async setStatus(
    connectionId: string,
    ownerId: string,
    status: StorageConnectionStatus,
  ): Promise<StorageConnection | null> {
    const now = new Date();

    const [row] = await this.dbs.db
      .update(storageConnections)
      .set({
        status,
        updatedAt: now,
        lastVerifiedAt:
          status === 'ready' ? now : undefined,
      })
      .where(
        and(
          eq(storageConnections.id, connectionId),
          eq(storageConnections.ownerId, ownerId),
        ),
      )
      .returning();

    return row ? this.toDomain(row) : null;
  }

  private toDomain(
    row: typeof storageConnections.$inferSelect,
  ): StorageConnection {
    return {
      id: row.id,
      ownerId: row.ownerId,
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      displayName: row.displayName,
      rootId: row.rootId,
      status: row.status,
      lastVerifiedAt: row.lastVerifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
