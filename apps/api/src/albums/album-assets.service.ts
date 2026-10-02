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
  albumProposals,
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
    const approved = await this.hasApprovedProposal(album, viewerId, membership);

    if (
      !canReadAlbum({
        visibility: album.visibility,
        ownerId: album.ownerId,
        viewerId,
        hasActiveMembership: membership,
        hasApprovedProposal: approved,
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

    // Pending/failed submissions stay owner-only until ready: public
    // visitors, members, and approved viewers only see ready assets.
    const isOwner = viewerId !== undefined && album.ownerId === viewerId;
    const visible = isOwner ? rows : rows.filter((row) => row.status === 'ready');
    return { assets: visible.map((row) => this.toContract(row)) };
  }

  /**
   * Anonymous public gallery: only public albums, only ready assets.
   * No session is required or trusted; private albums read as missing
   * (404) and pending/failed/deleted rows never surface. The contract
   * keeps storageConnectionId + providerFileId per asset and carries no
   * uploader emails or tokens.
   */
  async listPublicAssets(albumId: string): Promise<AlbumAssetsResponse> {
    const album = await this.requireAlbum(albumId);
    if (album.visibility !== 'public') throw this.albumNotFound();

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

    return {
      assets: rows
        .filter((row) => row.status === 'ready')
        .map((row) => this.toContract(row)),
    };
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

  /**
   * Records an explicit failed state for a pending asset whose provider
   * upload did not verify (transport error, invalid provider response,
   * size mismatch). Pending rows are never left dangling silently, and a
   * ready asset can never move back to failed.
   */
  async markFailed(
    assetId: string,
    requesterId: string,
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

    if (asset.status === 'failed') return this.toContract(asset);

    if (!canTransitionAlbumAssetStatus(asset.status, 'failed')) {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-asset-status',
        title: 'Asset status transition not allowed',
        status: 409,
        detail: 'Solo un contenido pendiente puede pasar a fallido.',
      });
    }

    const [updated] = await this.dbs.db
      .update(albumAssets)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(albumAssets.id, assetId))
      .returning();

    if (!updated) throw this.assetNotFound();
    return this.toContract(updated);
  }

  /**
   * Single-asset metadata for multi-drive galleries. Same visibility rules
   * as the list: private albums are indistinguishable from missing ones
   * (404), and deleted rows never surface. The contract always carries
   * storageConnectionId + providerFileId so the client knows which Drive
   * each asset lives in; bytes are never included here.
   */
  async getOne(
    albumId: string,
    assetId: string,
    viewerId: string | undefined,
  ): Promise<AlbumAssetContract> {
    const album = await this.requireAlbum(albumId);
    const membership = await this.membershipFor(album, viewerId);
    const approved = await this.hasApprovedProposal(album, viewerId, membership);

    if (
      !canReadAlbum({
        visibility: album.visibility,
        ownerId: album.ownerId,
        viewerId,
        hasActiveMembership: membership,
        hasApprovedProposal: approved,
      })
    ) {
      throw this.albumNotFound();
    }

    const asset = await this.requireScopedAsset(albumId, assetId);
    if (asset.status === 'deleted') throw this.assetNotFound();
    // Restricted preview: pending/failed rows are owner-only. Members,
    // approved viewers, and public visitors read them as missing (404)
    // so QR possession or id guessing never reveals unapproved content.
    if (asset.status !== 'ready' && album.ownerId !== viewerId) {
      throw this.assetNotFound();
    }
    return this.toContract(asset);
  }

  /**
   * Anonymous public metadata for one ready asset. Private albums read as
   * missing; non-ready rows read as missing (never 409 here, to avoid
   * revealing pending submissions on the public surface).
   */
  async getPublicAsset(
    albumId: string,
    assetId: string,
  ): Promise<AlbumAssetContract> {
    const album = await this.requireAlbum(albumId);
    if (album.visibility !== 'public') throw this.albumNotFound();

    const asset = await this.requireScopedAsset(albumId, assetId);
    if (asset.status !== 'ready') throw this.assetNotFound();
    return this.toContract(asset);
  }

  async requestDelete(
    albumId: string,
    assetId: string,
    requesterId: string,
  ): Promise<{ success: true }> {
    const asset = await this.authorizeDelete(albumId, assetId, requesterId);
    return this.finalizeDeleted(asset);
  }

  /**
   * Authz half of a delete: the asset scoped to its album (cross-album
   * reads 404) plus the owner-or-uploader membership check (403). The
   * provider-aware path runs this first, deletes in Drive, and only then
   * calls finalizeDeleted — authz can never be skipped or reordered.
   */
  async authorizeDelete(
    albumId: string,
    assetId: string,
    requesterId: string,
  ): Promise<AlbumAssetContract> {
    const album = await this.requireAlbum(albumId);
    const asset = await this.requireScopedAsset(albumId, assetId);

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

    return this.toContract(asset);
  }

  /**
   * Local half of a delete: idempotent, transition-checked, no provider
   * touch. Accepts the authorized snapshot so requestDelete keeps its exact
   * query sequence and provider deletes never run twice for one call.
   */
  async finalizeDeleted(
    asset: Pick<AlbumAssetContract, 'id' | 'status'>,
  ): Promise<{ success: true }> {
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
      .where(eq(albumAssets.id, asset.id));

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
   * Album-scoped asset load: an id from another album reads as missing
   * (404) so asset ids can never be used as cross-album oracles.
   */
  private async requireScopedAsset(
    albumId: string,
    assetId: string,
  ): Promise<AlbumAssetRow> {
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

  /**
   * Approved-proposal viewers may read private assets after owner
   * moderation. Invited-but-not-accepted memberships and raw QR
   * possession grant nothing: only an `approved` proposal row counts.
   */
  private async hasApprovedProposal(
    album: AlbumRow,
    viewerId: string | undefined,
    hasActiveMembership: boolean,
  ): Promise<boolean> {
    if (!viewerId || album.ownerId === viewerId || hasActiveMembership) {
      return false;
    }

    const [proposal] = await this.dbs.db
      .select({ id: albumProposals.id })
      .from(albumProposals)
      .where(
        and(
          eq(albumProposals.albumId, album.id),
          eq(albumProposals.proposedBy, viewerId),
          eq(albumProposals.status, 'approved'),
        ),
      )
      .limit(1);

    return Boolean(proposal);
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
