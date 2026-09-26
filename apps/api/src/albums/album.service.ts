import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, or } from 'drizzle-orm';
import type {
  AlbumContract,
  AlbumListResponse,
  AlbumStorageBindingContract,
  CreateAlbumInput,
  UpdateAlbumInput,
} from '@irec/contracts';

import { DatabaseService } from '../database/database.service.js';
import { albumMembers, albums } from '../database/schema.js';
import { StorageConnectionService } from '../storage/storage.service.js';
import { canReadAlbum, canUpdateAlbum } from './album.policy.js';

type AlbumRow = typeof albums.$inferSelect;

@Injectable()
export class AlbumService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly storage: StorageConnectionService,
  ) {}

  async create(userId: string, input: CreateAlbumInput): Promise<AlbumContract> {
    const now = new Date();

    return this.dbs.db.transaction(async (tx) => {
      const [album] = await tx
        .insert(albums)
        .values({
          ownerId: userId,
          title: input.title,
          description: input.description ?? null,
          visibility: input.visibility,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!album) {
        throw new Error('No se pudo crear el album.');
      }

      await tx.insert(albumMembers).values({
        albumId: album.id,
        userId,
        role: 'owner',
        status: 'active',
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      return this.toContract(album);
    });
  }

  async listForUser(userId: string): Promise<AlbumListResponse> {
    const rows = await this.dbs.db
      .select({
        id: albums.id,
        ownerId: albums.ownerId,
        title: albums.title,
        description: albums.description,
        visibility: albums.visibility,
        storageConnectionId: albums.storageConnectionId,
        createdAt: albums.createdAt,
        updatedAt: albums.updatedAt,
      })
      .from(albums)
      .leftJoin(
        albumMembers,
        and(
          eq(albumMembers.albumId, albums.id),
          eq(albumMembers.userId, userId),
          eq(albumMembers.status, 'active'),
        ),
      )
      .where(
        or(
          eq(albums.ownerId, userId),
          eq(albumMembers.status, 'active'),
        ),
      )
      .orderBy(desc(albums.updatedAt));

    return {
      albums: rows.map((row) => this.toContract(row)),
    };
  }

  async getById(
    albumId: string,
    viewerId: string | undefined,
  ): Promise<AlbumContract> {
    const album = await this.findAlbum(albumId);
    if (!album) throw this.notFound();

    let hasActiveMembership = false;

    if (
      viewerId &&
      album.visibility === 'private' &&
      album.ownerId !== viewerId
    ) {
      const [membership] = await this.dbs.db
        .select({ userId: albumMembers.userId })
        .from(albumMembers)
        .where(
          and(
            eq(albumMembers.albumId, albumId),
            eq(albumMembers.userId, viewerId),
            eq(albumMembers.status, 'active'),
          ),
        )
        .limit(1);

      hasActiveMembership = Boolean(membership);
    }

    if (
      !canReadAlbum({
        visibility: album.visibility,
        ownerId: album.ownerId,
        viewerId,
        hasActiveMembership,
      })
    ) {
      throw this.notFound();
    }

    return this.toContract(album);
  }

  async update(
    albumId: string,
    userId: string,
    input: UpdateAlbumInput,
  ): Promise<AlbumContract> {
    const existing = await this.findAlbum(albumId);
    if (!existing) throw this.notFound();

    if (!canUpdateAlbum(existing.ownerId, userId)) {
      throw new ForbiddenException({
        type: 'https://irec.app/problems/album-forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Solo el propietario puede modificar este album.',
      });
    }

    const patch: Partial<typeof albums.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.visibility !== undefined) patch.visibility = input.visibility;

    const [updated] = await this.dbs.db
      .update(albums)
      .set(patch)
      .where(eq(albums.id, albumId))
      .returning();

    if (!updated) throw this.notFound();
    return this.toContract(updated);
  }

  async setStorageConnection(
    albumId: string,
    ownerId: string,
    storageConnectionId: string | null,
  ): Promise<AlbumStorageBindingContract> {
    const existing = await this.findAlbum(albumId);
    if (!existing) throw this.notFound();

    if (!canUpdateAlbum(existing.ownerId, ownerId)) {
      throw new ForbiddenException({
        type: 'https://irec.app/problems/album-forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Solo el propietario puede configurar el storage del album.',
      });
    }

    if (storageConnectionId !== null) {
      await this.storage.requireOwned(ownerId, storageConnectionId);
    }

    const [updated] = await this.dbs.db
      .update(albums)
      .set({
        storageConnectionId,
        updatedAt: new Date(),
      })
      .where(eq(albums.id, albumId))
      .returning({
        albumId: albums.id,
        storageConnectionId: albums.storageConnectionId,
      });

    if (!updated) throw this.notFound();
    return updated;
  }

  private async findAlbum(albumId: string): Promise<AlbumRow | undefined> {
    const [album] = await this.dbs.db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    return album;
  }

  private toContract(album: AlbumRow): AlbumContract {
    return {
      id: album.id,
      ownerId: album.ownerId,
      title: album.title,
      description: album.description,
      visibility: album.visibility,
      createdAt: album.createdAt.toISOString(),
      updatedAt: album.updatedAt.toISOString(),
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      type: 'https://irec.app/problems/album-not-found',
      title: 'Album not found',
      status: 404,
      detail: 'El album no existe o no esta disponible para esta sesion.',
    });
  }
}
