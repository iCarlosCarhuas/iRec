import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type {
  AlbumMemberViewContract,
  AlbumMembersResponse,
  InviteAlbumMemberInput,
} from '@irec/contracts';

import { DatabaseService } from '../database/database.service.js';
import { albumMembers, albums, users } from '../database/schema.js';
import {
  canManageAlbumMembers,
  canViewAlbumMembers,
} from './album.policy.js';

type AlbumRow = typeof albums.$inferSelect;

@Injectable()
export class AlbumMembersService {
  constructor(private readonly dbs: DatabaseService) {}

  async list(albumId: string, viewerId: string): Promise<AlbumMembersResponse> {
    const album = await this.requireAlbum(albumId);
    const hasActiveMembership =
      album.ownerId === viewerId
        ? true
        : await this.hasActiveMembership(albumId, viewerId);

    if (
      !canViewAlbumMembers(
        album.ownerId,
        viewerId,
        hasActiveMembership,
      )
    ) {
      throw this.albumNotFound();
    }

    const rows = await this.dbs.db
      .select({
        albumId: albumMembers.albumId,
        userId: albumMembers.userId,
        email: users.email,
        role: albumMembers.role,
        status: albumMembers.status,
        joinedAt: albumMembers.joinedAt,
        createdAt: albumMembers.createdAt,
        updatedAt: albumMembers.updatedAt,
      })
      .from(albumMembers)
      .innerJoin(users, eq(albumMembers.userId, users.id))
      .where(eq(albumMembers.albumId, albumId))
      .orderBy(asc(albumMembers.createdAt));

    return {
      members: rows.map((row) => this.toContract(row)),
    };
  }

  async invite(
    albumId: string,
    ownerId: string,
    input: InviteAlbumMemberInput,
  ): Promise<AlbumMemberViewContract> {
    const album = await this.requireAlbum(albumId);
    this.requireMemberManager(album, ownerId);

    const email = input.email.trim().toLowerCase();
    const [target] = await this.dbs.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          eq(users.email, email),
          isNotNull(users.emailVerifiedAt),
        ),
      )
      .limit(1);

    if (!target) {
      throw new BadRequestException({
        type: 'https://irec.app/problems/member-not-invitable',
        title: 'Member cannot be invited',
        status: 400,
        detail: 'No se puede invitar este correo.',
      });
    }

    if (target.id === album.ownerId) {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-owner-membership',
        title: 'Owner already belongs to album',
        status: 409,
        detail: 'El propietario ya pertenece al album.',
      });
    }

    const existing = await this.findMembership(albumId, target.id);

    if (existing?.role === 'owner') {
      throw new ConflictException('No se puede modificar la membresia del propietario.');
    }

    if (existing?.status === 'active') {
      throw new ConflictException({
        type: 'https://irec.app/problems/member-already-active',
        title: 'Member already active',
        status: 409,
        detail: 'El usuario ya es miembro activo del album.',
      });
    }

    if (existing?.status === 'invited') {
      return this.readMember(albumId, target.id);
    }

    const now = new Date();

    if (existing) {
      await this.dbs.db
        .update(albumMembers)
        .set({
          role: 'member',
          status: 'invited',
          joinedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(albumMembers.albumId, albumId),
            eq(albumMembers.userId, target.id),
          ),
        );
    } else {
      await this.dbs.db.insert(albumMembers).values({
        albumId,
        userId: target.id,
        role: 'member',
        status: 'invited',
        joinedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return this.readMember(albumId, target.id);
  }

  async accept(
    albumId: string,
    userId: string,
  ): Promise<AlbumMemberViewContract> {
    await this.requireAlbum(albumId);
    const membership = await this.findMembership(albumId, userId);

    if (!membership) {
      throw new NotFoundException({
        type: 'https://irec.app/problems/album-invitation-not-found',
        title: 'Invitation not found',
        status: 404,
        detail: 'No existe una invitacion disponible para esta cuenta.',
      });
    }

    if (membership.role === 'owner') {
      throw new ConflictException('El propietario ya es miembro activo.');
    }

    if (membership.status === 'active') {
      return this.readMember(albumId, userId);
    }

    if (membership.status !== 'invited') {
      throw new ConflictException({
        type: 'https://irec.app/problems/album-invitation-unavailable',
        title: 'Invitation unavailable',
        status: 409,
        detail: 'La invitacion ya no esta disponible.',
      });
    }

    const now = new Date();
    const updated = await this.dbs.db
      .update(albumMembers)
      .set({
        status: 'active',
        joinedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(albumMembers.albumId, albumId),
          eq(albumMembers.userId, userId),
          eq(albumMembers.status, 'invited'),
        ),
      )
      .returning({ userId: albumMembers.userId });

    if (!updated.length) {
      const current = await this.findMembership(albumId, userId);
      if (current?.status === 'active') {
        return this.readMember(albumId, userId);
      }
      throw new ConflictException('La invitacion cambio de estado.');
    }

    return this.readMember(albumId, userId);
  }

  async remove(
    albumId: string,
    ownerId: string,
    targetUserId: string,
  ): Promise<{ success: true }> {
    const album = await this.requireAlbum(albumId);
    this.requireMemberManager(album, ownerId);

    if (targetUserId === album.ownerId) {
      throw new BadRequestException({
        type: 'https://irec.app/problems/owner-cannot-be-removed',
        title: 'Owner cannot be removed',
        status: 400,
        detail: 'El propietario no puede ser removido del album.',
      });
    }

    const membership = await this.findMembership(albumId, targetUserId);
    if (!membership) {
      throw new NotFoundException({
        type: 'https://irec.app/problems/album-member-not-found',
        title: 'Member not found',
        status: 404,
        detail: 'La membresia no existe.',
      });
    }

    if (membership.role === 'owner') {
      throw new BadRequestException('El propietario no puede ser removido.');
    }

    if (membership.status === 'removed') {
      return { success: true };
    }

    await this.dbs.db
      .update(albumMembers)
      .set({
        status: 'removed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(albumMembers.albumId, albumId),
          eq(albumMembers.userId, targetUserId),
        ),
      );

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

  private requireMemberManager(album: AlbumRow, viewerId: string): void {
    if (!canManageAlbumMembers(album.ownerId, viewerId)) {
      throw new ForbiddenException({
        type: 'https://irec.app/problems/album-members-forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Solo el propietario puede gestionar miembros.',
      });
    }
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

  private async findMembership(albumId: string, userId: string) {
    const [membership] = await this.dbs.db
      .select()
      .from(albumMembers)
      .where(
        and(
          eq(albumMembers.albumId, albumId),
          eq(albumMembers.userId, userId),
        ),
      )
      .limit(1);

    return membership;
  }

  private async readMember(
    albumId: string,
    userId: string,
  ): Promise<AlbumMemberViewContract> {
    const [row] = await this.dbs.db
      .select({
        albumId: albumMembers.albumId,
        userId: albumMembers.userId,
        email: users.email,
        role: albumMembers.role,
        status: albumMembers.status,
        joinedAt: albumMembers.joinedAt,
        createdAt: albumMembers.createdAt,
        updatedAt: albumMembers.updatedAt,
      })
      .from(albumMembers)
      .innerJoin(users, eq(albumMembers.userId, users.id))
      .where(
        and(
          eq(albumMembers.albumId, albumId),
          eq(albumMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('La membresia no existe.');
    }

    return this.toContract(row);
  }

  private toContract(row: {
    albumId: string;
    userId: string;
    email: string;
    role: 'owner' | 'member';
    status: 'active' | 'invited' | 'removed';
    joinedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AlbumMemberViewContract {
    return {
      albumId: row.albumId,
      userId: row.userId,
      email: row.email,
      role: row.role,
      status: row.status,
      joinedAt: row.joinedAt?.toISOString() ?? null,
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
}
