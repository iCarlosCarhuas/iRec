import {
  Body,
  Controller,
  Delete,
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
  AlbumMemberParamsSchema,
  InviteAlbumMemberInput,
  type AlbumIdParams,
  type AlbumMemberParams,
  type InviteAlbumMemberInput as InviteAlbumMemberInputType,
} from '@irec/contracts';

import { SessionService, type SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { AlbumMembersService } from './album-members.service.js';

const ACCESS_COOKIE = 'irec_access';

@Controller('albums/:albumId/members')
export class AlbumMembersController {
  constructor(
    private readonly members: AlbumMembersService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async list(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    const user = await this.requireSession(req);
    return this.members.list(params.albumId, user.id);
  }

  @Post('invite')
  async invite(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
    @Body(new ZodValidationPipe(InviteAlbumMemberInput))
    body: InviteAlbumMemberInputType,
  ) {
    const user = await this.requireSession(req);
    return this.members.invite(params.albumId, user.id, body);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    const user = await this.requireSession(req);
    return this.members.accept(params.albumId, user.id);
  }

  @Delete(':userId')
  async remove(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumMemberParamsSchema))
    params: AlbumMemberParams,
  ) {
    const user = await this.requireSession(req);
    return this.members.remove(params.albumId, user.id, params.userId);
  }

  private async requireSession(req: Request): Promise<SessionPayload> {
    const session = await this.sessions.getSession(req.cookies?.[ACCESS_COOKIE]);
    if (!session) throw new UnauthorizedException();
    return session;
  }
}
