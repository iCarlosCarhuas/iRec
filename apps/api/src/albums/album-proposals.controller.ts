import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AlbumIdParamsSchema,
  AlbumProposalParamsSchema,
  CreateAlbumProposalInput,
  type AlbumIdParams,
  type AlbumProposalParams,
  type CreateAlbumProposalInput as CreateAlbumProposalInputType,
} from '@irec/contracts';

import { SessionService, type SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { AlbumProposalsService } from './album-proposals.service.js';

const ACCESS_COOKIE = 'irec_access';

@Controller('albums/:albumId/proposals')
export class AlbumProposalsController {
  constructor(
    private readonly proposals: AlbumProposalsService,
    private readonly sessions: SessionService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
    @Body(new ZodValidationPipe(CreateAlbumProposalInput))
    body: CreateAlbumProposalInputType,
  ) {
    const user = await this.requireSession(req);
    return this.proposals.create(params.albumId, user.id, body);
  }

  @Get()
  async list(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    const user = await this.requireSession(req);
    return this.proposals.list(params.albumId, user.id);
  }

  @Post(':proposalId/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumProposalParamsSchema))
    params: AlbumProposalParams,
  ) {
    const user = await this.requireSession(req);
    return this.proposals.approve(params.albumId, params.proposalId, user.id);
  }

  @Post(':proposalId/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumProposalParamsSchema))
    params: AlbumProposalParams,
  ) {
    const user = await this.requireSession(req);
    return this.proposals.reject(params.albumId, params.proposalId, user.id);
  }

  private async requireSession(req: Request): Promise<SessionPayload> {
    const session = await this.sessions.getSession(req.cookies?.[ACCESS_COOKIE]);
    if (!session) throw new UnauthorizedException();
    return session;
  }
}
