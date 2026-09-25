import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type {
  AlbumProposalViewContract,
  AlbumProposalsResponse,
  CreateAlbumProposalInput,
} from '@irec/contracts';

import { DatabaseService } from '../database/database.service.js';
import {
  albumMembers,
  albumProposals,
  albums,
  users,
} from '../database/schema.js';
import {
  canCreateAlbumProposal,
  canModerateAlbumProposals,
} from './album.policy.js';

type AlbumRow = typeof albums.$inferSelect;
type ProposalStatus = 'pending' | 'approved' | 'rejected';

@Injectable()
export class AlbumProposalsService {
  constructor(private readonly dbs: DatabaseService) {}

  async create(
    albumId: string,
    userId: string,
    input: CreateAlbumProposalInput,
  ): Promise<AlbumProposalViewContract> {
    const album = await this.requireAlbum(albumId);
    const active = await this.hasActiveMembership(albumId, userId);

    if (!canCreateAlbumProposal(album.ownerId, userId, active)) {
      if (album.visibility === 'private' && album.ownerId !== userId && !active) {
        throw this.albumNotFound();
      }

      throw new ForbiddenException({
        type: 'https://irec.app/problems/album-proposal-forbidden',
        title: 'Proposal forbidden',
        status: 403,
        detail: 'Solo un miembro activo distinto del owner puede proponer contenido.',
      });
    }

    const [created] = await this.dbs.db
      .insert(albumProposals)
      .values({
        albumId,
        proposedBy: userId,
        text: input.text,
        status: 'pending',
      })
      .returning({ id: albumProposals.id });

    if (!created) {
      throw new ConflictException('No se pudo crear la propuesta.');
    }

    return this.readProposal(albumId, created.id);
  }

  async list(
    albumId: string,
    viewerId: string,
  ): Promise<AlbumProposalsResponse> {
    const album = await this.requireAlbum(albumId);
    await this.requireModerator(album, viewerId);

    const rows = await this.dbs.db
      .select({
        id: albumProposals.id,
        albumId: albumProposals.albumId,
        proposedBy: albumProposals.proposedBy,
        proposerEmail: users.email,
        text: albumProposals.text,
        status: albumProposals.status,
        moderatedBy: albumProposals.moderatedBy,
        moderatedAt: albumProposals.moderatedAt,
        createdAt: albumProposals.createdAt,
        updatedAt: albumProposals.updatedAt,
      })
      .from(albumProposals)
      .innerJoin(users, eq(albumProposals.proposedBy, users.id))
      .where(eq(albumProposals.albumId, albumId))
      .orderBy(desc(albumProposals.createdAt));

    return {
      proposals: rows.map((row) => this.toContract(row)),
    };
  }

  async approve(
    albumId: string,
    proposalId: string,
    ownerId: string,
  ): Promise<AlbumProposalViewContract> {
    return this.moderate(albumId, proposalId, ownerId, 'approved');
  }

  async reject(
    albumId: string,
    proposalId: string,
    ownerId: string,
  ): Promise<AlbumProposalViewContract> {
    return this.moderate(albumId, proposalId, ownerId, 'rejected');
  }

  private async moderate(
    albumId: string,
    proposalId: string,
    ownerId: string,
    targetStatus: Exclude<ProposalStatus, 'pending'>,
  ): Promise<AlbumProposalViewContract> {
    const album = await this.requireAlbum(albumId);
    await this.requireModerator(album, ownerId);

    const current = await this.findProposal(albumId, proposalId);
    if (!current) throw this.proposalNotFound();

    if (current.status === targetStatus) {
      return this.readProposal(albumId, proposalId);
    }

    if (current.status !== 'pending') {
      throw new ConflictException({
        type: 'https://irec.app/problems/proposal-already-decided',
        title: 'Proposal already decided',
        status: 409,
        detail: 'La propuesta ya tiene una decision final.',
      });
    }

    const now = new Date();
    const updated = await this.dbs.db
      .update(albumProposals)
      .set({
        status: targetStatus,
        moderatedBy: ownerId,
        moderatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(albumProposals.id, proposalId),
          eq(albumProposals.albumId, albumId),
          eq(albumProposals.status, 'pending'),
        ),
      )
      .returning({ id: albumProposals.id });

    if (!updated.length) {
      const afterRace = await this.findProposal(albumId, proposalId);

      if (afterRace?.status === targetStatus) {
        return this.readProposal(albumId, proposalId);
      }

      throw new ConflictException({
        type: 'https://irec.app/problems/proposal-already-decided',
        title: 'Proposal already decided',
        status: 409,
        detail: 'La propuesta cambio de estado antes de completar la operacion.',
      });
    }

    return this.readProposal(albumId, proposalId);
  }

  private async requireModerator(
    album: AlbumRow,
    viewerId: string,
  ): Promise<void> {
    if (canModerateAlbumProposals(album.ownerId, viewerId)) return;

    const active = await this.hasActiveMembership(album.id, viewerId);

    if (album.visibility === 'private' && !active) {
      throw this.albumNotFound();
    }

    throw new ForbiddenException({
      type: 'https://irec.app/problems/album-moderation-forbidden',
      title: 'Moderation forbidden',
      status: 403,
      detail: 'Solo el owner puede moderar propuestas.',
    });
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

  private async findProposal(albumId: string, proposalId: string) {
    const [proposal] = await this.dbs.db
      .select()
      .from(albumProposals)
      .where(
        and(
          eq(albumProposals.id, proposalId),
          eq(albumProposals.albumId, albumId),
        ),
      )
      .limit(1);

    return proposal;
  }

  private async readProposal(
    albumId: string,
    proposalId: string,
  ): Promise<AlbumProposalViewContract> {
    const [row] = await this.dbs.db
      .select({
        id: albumProposals.id,
        albumId: albumProposals.albumId,
        proposedBy: albumProposals.proposedBy,
        proposerEmail: users.email,
        text: albumProposals.text,
        status: albumProposals.status,
        moderatedBy: albumProposals.moderatedBy,
        moderatedAt: albumProposals.moderatedAt,
        createdAt: albumProposals.createdAt,
        updatedAt: albumProposals.updatedAt,
      })
      .from(albumProposals)
      .innerJoin(users, eq(albumProposals.proposedBy, users.id))
      .where(
        and(
          eq(albumProposals.id, proposalId),
          eq(albumProposals.albumId, albumId),
        ),
      )
      .limit(1);

    if (!row) throw this.proposalNotFound();
    return this.toContract(row);
  }

  private toContract(row: {
    id: string;
    albumId: string;
    proposedBy: string;
    proposerEmail: string;
    text: string;
    status: ProposalStatus;
    moderatedBy: string | null;
    moderatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AlbumProposalViewContract {
    return {
      id: row.id,
      albumId: row.albumId,
      proposedBy: row.proposedBy,
      proposerEmail: row.proposerEmail,
      text: row.text,
      status: row.status,
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

  private proposalNotFound(): NotFoundException {
    return new NotFoundException({
      type: 'https://irec.app/problems/proposal-not-found',
      title: 'Proposal not found',
      status: 404,
      detail: 'La propuesta no existe en este album.',
    });
  }
}
