import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type {
  CreateStorageConnectionInput,
  StorageConnectionContract,
  StorageConnectionsResponse,
} from '@irec/contracts';

import { DatabaseService } from '../database/database.service.js';
import { storageConnections } from '../database/schema.js';
import { CryptoService } from '../security/crypto.service.js';

export type OwnedStorageCredentials = {
  id: string;
  ownerId: string;
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  lastVerifiedAt: Date;
};

type StorageConnectionRow = typeof storageConnections.$inferSelect;

@Injectable()
export class StorageConnectionService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Persistence boundary for a connection that has already passed the R2
   * validation flow. R2-1 does not expose this method through HTTP and does not
   * perform network validation itself; R2-2 owns that responsibility.
   */
  async persistVerified(
    ownerId: string,
    input: CreateStorageConnectionInput,
    verifiedAt: Date,
  ): Promise<StorageConnectionContract> {
    const now = new Date();
    const [row] = await this.dbs.db
      .insert(storageConnections)
      .values({
        ownerId,
        accountId: input.accountId,
        bucket: input.bucket,
        accessKeyIdEncrypted: this.crypto.encrypt(input.accessKeyId),
        secretAccessKeyEncrypted: this.crypto.encrypt(input.secretAccessKey),
        lastVerifiedAt: verifiedAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!row) throw new Error('No se pudo guardar la conexion de almacenamiento.');
    return this.toContract(row);
  }

  async listForOwner(ownerId: string): Promise<StorageConnectionsResponse> {
    const rows = await this.dbs.db
      .select()
      .from(storageConnections)
      .where(eq(storageConnections.ownerId, ownerId))
      .orderBy(asc(storageConnections.createdAt));

    return { connections: rows.map((row) => this.toContract(row)) };
  }

  async getOwnedCredentials(
    ownerId: string,
    connectionId: string,
  ): Promise<OwnedStorageCredentials> {
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

    if (!row) throw this.notFound();

    return {
      id: row.id,
      ownerId: row.ownerId,
      accountId: row.accountId,
      bucket: row.bucket,
      accessKeyId: this.crypto.decrypt(row.accessKeyIdEncrypted),
      secretAccessKey: this.crypto.decrypt(row.secretAccessKeyEncrypted),
      lastVerifiedAt: row.lastVerifiedAt,
    };
  }

  async requireOwned(
    ownerId: string,
    connectionId: string,
  ): Promise<StorageConnectionContract> {
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

    if (!row) throw this.notFound();
    return this.toContract(row);
  }

  private toContract(row: StorageConnectionRow): StorageConnectionContract {
    return {
      id: row.id,
      ownerId: row.ownerId,
      accountId: row.accountId,
      bucket: row.bucket,
      lastVerifiedAt: row.lastVerifiedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      type: 'https://irec.app/problems/storage-connection-not-found',
      title: 'Storage connection not found',
      status: 404,
      detail: 'La conexion de almacenamiento no existe o no pertenece a esta cuenta.',
    });
  }
}
