import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, or } from 'drizzle-orm';
import type {
  AlbumAssetContract,
  AlbumAssetsResponse,
  AlbumAssetStatus,
} from '@irec/contracts';

import { DatabaseService } from '../database/database.service.js';
import {
  albumAssets,
  albumMembers,
  albums,
  storageConnections,
} from '../database/schema.js';
import { canReadAlbum } from './album.policy.js';
import {
  canModerateAlbumAssets,
  canSeeAlbumAsset,
  initialAlbumAssetStatus,
} from './album-assets.policy.js';

type AlbumRow = typeof albums.$inferSelect;
type AssetRow = typeof albumAssets.$inferSelect;

export type RegisterUploadedAlbumAssetInput = {
  objectKey: string;
  thumbnailObjectKey?: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  checksum?: string | null;
  uploadedAt: Date;
};

@Injectable()
export class AlbumAssetsService {
  constructor(private readonly dbs: DatabaseService) {}

  /**
   * Internal boundary for R2-4. There is intentionally no public HTTP create
   * endpoint in R2-3: a row may only be registered after the upload flow has
   * validated the real R2 object.
   */
  async registerUploaded(
    albumId: string,
    uploaderId: string,
    input: RegisterUploadedAlbumAssetInput,
  ): Promise<AlbumAssetContract> {
    const album = await this.requireAlbum(albumId);
    const hasActiveMembership =
      album.ownerId === uploaderId
        ? true
        : await this.hasActiveMembership(albumId, uploaderId);

    const status = initialAlbumAssetStatus(
      album.ownerId,
      uploaderId,
      hasActiveMembership,
    );

    if (!status) {
      if (album.visibility === 'private') throw this.albumNotFound();

      throw new ForbiddenException({
        type: 'https://irec.app/problems/album-asset-upload-forbidden',
        title: 'Asset upload forbidden',
        status: 403,
        detail: 'Solo el owner o un miembro activo puede cargar fotos.',
      });
    }

    const storageConnectionId = await this.requireAlbumStorage(album);

    const now = new Date();
    const [row] = await this.dbs.db
      .insert(albumAssets)
      .values({
        albumId,
        storageConnectionId,
        uploadedBy: uploaderId,
        objectKey: input.objectKey,
        thumbnailObjectKey: input.thumbnailObjectKey ?? null,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width ?? null,
        height: input.height ?? null,
        checksum: input.checksum ?? null,
        status,
        uploadedAt: input.uploadedAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!row) throw new ConflictException('No se pudo registrar el asset.');
    return this.toContract(row);
  }

  async list(
    albumId: string,
    viewerId: string | undefined,
  ): Promise<AlbumAssetsResponse> {
    const album = await this.requireAlbum(albumId);
    const hasActiveMembership =
      viewerId && album.ownerId !== viewerId
        ? await this.hasActiveMembership(albumId, viewerId)
        : false;

    if (
      !canReadAlbum({
        visibility: album.visibility,
        ownerId: album.ownerId,
        viewerId,
        hasActiveMembership,
      })
    ) {
      throw this.albumNotFound();
    }

    const base = eq(albumAssets.albumId, albumId);
    const visibility =
      viewerId === album.ownerId
        ? base
        : viewerId && hasActiveMembership
          ? and(
              base,
              or(
                eq(albumAssets.status, 'approved'),
                eq(albumAssets.uploadedBy, viewerId),
              ),
            )
          : and(base, eq(albumAssets.status, 'approved'));

    const rows = await this.dbs.db
      .select()
      .from(albumAssets)
      .where(visibility)
      .orderBy(desc(albumAssets.createdAt));

    return {
      assets: rows
        .filter((row) =>
          canSeeAlbumAsset(
            row.status,
            album.ownerId,
            row.uploadedBy,
            viewerId,
            Boolean(hasActiveMembership),
          ),
        )
        .map((row) => this.toContract(row)),
    };
  }

  async approve(
    albumId: string,
    assetId: string,
    ownerId: string,
  ): Promise<AlbumAssetContract> {
    return this.moderate(albumId, assetId, ownerId, 'approved');
  }

  async reject(
    albumId: string,
    assetId: string,
    ownerId: string,
  ): Promise<AlbumAssetContract> {
    return this.moderate(albumId, assetId, ownerId, 'rejected');
  }

  private async moderate(
    albumId: string,
    assetId: string,
    ownerId: string,
    targetStatus: Exclude<AlbumAssetStatus, 'pending'>,
  ): Promise<AlbumAssetContract> {
    const album = await this.requireAlbum(albumId);

    if (!canModerateAlbumAssets(album.ownerId, ownerId)) {
      const active = await this.hasActiveMembership(albumId, ownerId);
      if (album.visibility === 'private' && !active) throw this.albumNotFound();

      throw new ForbiddenException({
        type: 'https://irec.app/problems/album-asset-moderation-forbidden',
        title: 'Asset moderation forbidden',
        status: 403,
        detail: 'Solo el owner puede moderar fotos.',
      });
    }

    const current = await this.findAsset(albumId, assetId);
    if (!current) throw this.assetNotFound();

    if (current.status === targetStatus) return this.toContract(current);

    if (current.status !== 'pending') {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-asset-already-decided',
        title: 'Asset already decided',
        status: 409,
        detail: 'El asset ya tiene una decision final.',
      });
    }

    const now = new Date();
    const [updated] = await this.dbs.db
      .update(albumAssets)
      .set({
        status: targetStatus,
        moderatedBy: ownerId,
        moderatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(albumAssets.id, assetId),
          eq(albumAssets.albumId, albumId),
          eq(albumAssets.status, 'pending'),
        ),
      )
      .returning();

    if (!updated) {
      const afterRace = await this.findAsset(albumId, assetId);
      if (afterRace?.status === targetStatus) return this.toContract(afterRace);

      throw new ConflictException({
        type: 'https://irec.app/problems/album-asset-already-decided',
        title: 'Asset already decided',
        status: 409,
        detail: 'El asset cambio de estado antes de completar la operacion.',
      });
    }

    return this.toContract(updated);
  }

  private async requireAlbumStorage(album: AlbumRow): Promise<string> {
    if (!album.storageConnectionId) {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-storage-not-configured',
        title: 'Album storage not configured',
        status: 409,
        detail: 'El album no tiene una conexion de almacenamiento configurada.',
      });
    }

    const [connection] = await this.dbs.db
      .select({ id: storageConnections.id })
      .from(storageConnections)
      .where(
        and(
          eq(storageConnections.id, album.storageConnectionId),
          eq(storageConnections.ownerId, album.ownerId),
        ),
      )
      .limit(1);

    if (!connection) {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-storage-invalid',
        title: 'Album storage invalid',
        status: 409,
        detail: 'La conexion del album no pertenece a su owner.',
      });
    }

    return connection.id;
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

  private async hasActiveMembership(
    albumId: string,
    userId: string,
  ): Promise<boolean> {
    const [membership] = await this.dbs.db
      .select({ userId: albumMembers.userId })
      .from(albumMembers)
      .where(
        and(
          eq(albumMembers.albumId, albumId),
          eq(albumMembers.userId, userId),
          eq(albumMembers.status, 'active'),
        ),
      )
      .limit(1);

    return Boolean(membership);
  }

  private async findAsset(
    albumId: string,
    assetId: string,
  ): Promise<AssetRow | undefined> {
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

    return asset;
  }

  private toContract(row: AssetRow): AlbumAssetContract {
    return {
      id: row.id,
      albumId: row.albumId,
      uploadedBy: row.uploadedBy,
      originalFilename: row.originalFilename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
      status: row.status,
      uploadedAt: row.uploadedAt?.toISOString() ?? null,
      moderatedBy: row.moderatedBy,
      moderatedAt: row.moderatedAt?.toISOString() ?? null,
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
      title: 'Album asset not found',
      status: 404,
      detail: 'El asset no existe en este album.',
    });
  }
}
