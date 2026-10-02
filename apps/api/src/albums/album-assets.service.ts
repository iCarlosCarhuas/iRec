import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import type {
  AlbumAssetContract,
  AlbumAssetsResponse,
  CreateAlbumAssetInput,
  FinalizeAlbumAssetInput,
} from '@irec/contracts';

import { DatabaseService } from '../database/database.service.js';
import {
  albumAssets,
  albumMembers,
  albums,
  storageConnections,
} from '../database/schema.js';
import {
  canCreateAlbumAsset,
  canDeleteAlbumAsset,
  canFinalizeAlbumAsset,
  canTransitionAlbumAssetStatus,
} from './album-assets.policy.js';
import { canReadAlbum } from './album.policy.js';

type AlbumRow = typeof albums.$inferSelect;
type AlbumAssetRow = typeof albumAssets.$inferSelect;

@Injectable()
export class AlbumAssetsService {
  constructor(private readonly dbs: DatabaseService) {}

  async createPending(
    albumId: string,
    uploaderId: string,
    input: CreateAlbumAssetInput,
  ): Promise<AlbumAssetContract> {
    const album = await this.requireAlbum(albumId);
    const membership = await this.membershipFor(album, uploaderId);

    if (!canCreateAlbumAsset(album.ownerId, uploaderId, membership)) {
      throw this.forbidden('Solo miembros del album pueden agregar contenido.');
    }

    const connection = await this.requireOwnedReadyConnection(
      input.storageConnectionId,
      uploaderId,
    );

    const now = new Date();
    const [row] = await this.dbs.db
      .insert(albumAssets)
      .values({
        albumId,
        uploadedBy: uploaderId,
        storageConnectionId: connection.id,
        provider: 'google_drive',
        providerFileId: null,
        mimeType: input.mimeType,
        originalName: input.originalName,
        sizeBytes: input.sizeBytes,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!row) {
      throw new Error('Album asset could not be created');
    }

    return this.toContract(row);
  }

  async listByAlbum(
    albumId: string,
    viewerId: string | undefined,
  ): Promise<AlbumAssetsResponse> {
    const album = await this.requireAlbum(albumId);
    const membership = await this.membershipFor(album, viewerId);

    if (
      !canReadAlbum({
        visibility: album.visibility,
        ownerId: album.ownerId,
        viewerId,
        hasActiveMembership: membership,
      })
    ) {
      // Private albums are intentionally indistinguishable from missing albums.
      throw this.albumNotFound();
    }

    const rows = await this.dbs.db
      .select()
      .from(albumAssets)
      .where(
        and(
          eq(albumAssets.albumId, albumId),
          ne(albumAssets.status, 'deleted'),
        ),
      )
      .orderBy(asc(albumAssets.createdAt));

    return { assets: rows.map((row) => this.toContract(row)) };
  }

  /**
   * Stub until the Drive upload wiring lands: records the provider file
   * produced by a verified upload. Only pending assets may be finalized.
   */
  async finalizeAfterVerify(
    assetId: string,
    requesterId: string,
    input: FinalizeAlbumAssetInput,
  ): Promise<AlbumAssetContract> {
    const asset = await this.requireAsset(assetId);
    const album = await this.requireAlbum(asset.albumId);
    const membership = await this.membershipFor(album, requesterId);

    if (
      !canFinalizeAlbumAsset(
        album.ownerId,
        asset.uploadedBy,
        requesterId,
        membership,
      )
    ) {
      throw this.forbidden('Solo el propietario o quien subio el contenido puede finalizarlo.');
    }

    if (!canTransitionAlbumAssetStatus(asset.status, 'ready')) {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-asset-status',
        title: 'Asset status transition not allowed',
        status: 409,
        detail: 'Solo un contenido pendiente puede pasar a listo.',
      });
    }

    const [updated] = await this.dbs.db
      .update(albumAssets)
      .set({
        providerFileId: input.providerFileId,
        status: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(albumAssets.id, assetId))
      .returning();

    if (!updated) throw this.assetNotFound();
    return this.toContract(updated);
  }

  async requestDelete(
    albumId: string,
    assetId: string,
    requesterId: string,
  ): Promise<{ success: true }> {
    const album = await this.requireAlbum(albumId);
    const [asset] = await this.dbs.db
      .select()
      .from(albumAssets)
      .where(
        and(
          eq(albumAssets.id, assetId),
          eq(albumAssets.albumId, albumId),
        ),
      )
      .limit(1);

    if (!asset) throw this.assetNotFound();

    const membership = await this.membershipFor(album, requesterId);

    if (
      !canDeleteAlbumAsset(
        album.ownerId,
        asset.uploadedBy,
        requesterId,
        membership,
      )
    ) {
      throw this.forbidden('Solo el propietario o quien subio el contenido puede eliminarlo.');
    }

    if (asset.status === 'deleted') return { success: true };

    if (!canTransitionAlbumAssetStatus(asset.status, 'deleted')) {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-asset-status',
        title: 'Asset status transition not allowed',
        status: 409,
        detail: 'El contenido no puede eliminarse en su estado actual.',
      });
    }

    await this.dbs.db
      .update(albumAssets)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(albumAssets.id, assetId));

    return { success: true };
  }

  private async requireAlbum(albumId: string): Promise<AlbumRow> {
    const [album] = await this.dbs.db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    if (!album) throw this.albumNotFound();
    return album;
  }

  private async requireAsset(assetId: string): Promise<AlbumAssetRow> {
    const [asset] = await this.dbs.db
      .select()
      .from(albumAssets)
      .where(eq(albumAssets.id, assetId))
      .limit(1);

    if (!asset) throw this.assetNotFound();
    return asset;
  }

  /**
   * A user can never attach another user's connection: the owner predicate
   * makes foreign connections indistinguishable from missing ones (404).
   */
  private async requireOwnedReadyConnection(
    connectionId: string,
    ownerId: string,
  ) {
    const [connection] = await this.dbs.db
      .select()
      .from(storageConnections)
      .where(
        and(
          eq(storageConnections.id, connectionId),
          eq(storageConnections.ownerId, ownerId),
          eq(storageConnections.provider, 'google_drive'),
        ),
      )
      .limit(1);

    if (!connection) {
      throw new NotFoundException({
        type: 'https://irec.app/problems/storage-connection-not-found',
        title: 'Storage connection not found',
        status: 404,
        detail: 'La conexion no existe o no esta disponible para esta sesion.',
      });
    }

    if (connection.status !== 'ready') {
      throw new ConflictException({
        type: 'https://irec.app/problems/storage-connection-not-ready',
        title: 'Storage connection not ready',
        status: 409,
        detail: 'La conexion debe estar verificada antes de agregar contenido.',
      });
    }

    return connection;
  }

  private async membershipFor(
    album: AlbumRow,
    viewerId: string | undefined,
  ): Promise<boolean> {
    if (!viewerId || album.ownerId === viewerId) return viewerId !== undefined;

    const [membership] = await this.dbs.db
      .select({ userId: albumMembers.userId })
      .from(albumMembers)
      .where(
        and(
          eq(albumMembers.albumId, album.id),
          eq(albumMembers.userId, viewerId),
          eq(albumMembers.status, 'active'),
        ),
      )
      .limit(1);

    return Boolean(membership);
  }

  private toContract(row: AlbumAssetRow): AlbumAssetContract {
    return {
      id: row.id,
      albumId: row.albumId,
      uploadedBy: row.uploadedBy,
      storageConnectionId: row.storageConnectionId,
      provider: row.provider,
      providerFileId: row.providerFileId,
      mimeType: row.mimeType as AlbumAssetContract['mimeType'],
      originalName: row.originalName,
      sizeBytes: row.sizeBytes,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private albumNotFound(): NotFoundException {
    return new NotFoundException({
      type: 'https://irec.app/problems/album-not-found',
      title: 'Album not found',
      status: 404,
      detail: 'El album no existe o no esta disponible para esta sesion.',
    });
  }

  private assetNotFound(): NotFoundException {
    return new NotFoundException({
      type: 'https://irec.app/problems/album-asset-not-found',
      title: 'Asset not found',
      status: 404,
      detail: 'El contenido no existe en este album.',
    });
  }

  private forbidden(detail: string): ForbiddenException {
    return new ForbiddenException({
      type: 'https://irec.app/problems/album-asset-forbidden',
      title: 'Forbidden',
      status: 403,
      detail,
    });
  }
}
