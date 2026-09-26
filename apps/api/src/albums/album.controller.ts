import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AlbumIdParamsSchema,
  CreateAlbumInput,
  SetAlbumStorageConnectionInput,
  UpdateAlbumInput,
  type AlbumIdParams,
  type CreateAlbumInput as CreateAlbumInputType,
  type SetAlbumStorageConnectionInput as SetAlbumStorageConnectionInputType,
  type UpdateAlbumInput as UpdateAlbumInputType,
} from '@irec/contracts';

import { SessionService, type SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { AlbumService } from './album.service.js';

const ACCESS_COOKIE = 'irec_access';

@Controller('albums')
export class AlbumController {
  constructor(
    private readonly albums: AlbumService,
    private readonly sessions: SessionService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(CreateAlbumInput))
    body: CreateAlbumInputType,
  ) {
    const user = await this.requireSession(req);
    return this.albums.create(user.id, body);
  }

  @Get()
  async list(@Req() req: Request) {
    const user = await this.requireSession(req);
    return this.albums.listForUser(user.id);
  }

  @Get(':albumId')
  async getOne(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    const user = await this.optionalSession(req);
    return this.albums.getById(params.albumId, user?.id);
  }

  @Patch(':albumId')
  async update(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
    @Body(new ZodValidationPipe(UpdateAlbumInput))
    body: UpdateAlbumInputType,
  ) {
    const user = await this.requireSession(req);
    return this.albums.update(params.albumId, user.id, body);
  }


  @Put(':albumId/storage')
  async setStorageConnection(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
    @Body(new ZodValidationPipe(SetAlbumStorageConnectionInput))
    body: SetAlbumStorageConnectionInputType,
  ) {
    const user = await this.requireSession(req);
    return this.albums.setStorageConnection(
      params.albumId,
      user.id,
      body.storageConnectionId,
    );
  }

  private async requireSession(req: Request): Promise<SessionPayload> {
    const session = await this.optionalSession(req);
    if (!session) throw new UnauthorizedException();
    return session;
  }

  private async optionalSession(req: Request): Promise<SessionPayload | null> {
    return this.sessions.getSession(req.cookies?.[ACCESS_COOKIE]);
  }
}
