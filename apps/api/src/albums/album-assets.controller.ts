import {
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
  AlbumAssetParamsSchema,
  AlbumIdParamsSchema,
  type AlbumAssetParams,
  type AlbumIdParams,
} from '@irec/contracts';

import { SessionService, type SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { AlbumAssetsService } from './album-assets.service.js';

const ACCESS_COOKIE = 'irec_access';

@Controller('albums/:albumId/assets')
export class AlbumAssetsController {
  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async list(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    const user = await this.optionalSession(req);
    return this.assets.list(params.albumId, user?.id);
  }

  @Post(':assetId/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
  ) {
    const user = await this.requireSession(req);
    return this.assets.approve(params.albumId, params.assetId, user.id);
  }

  @Post(':assetId/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
  ) {
    const user = await this.requireSession(req);
    return this.assets.reject(params.albumId, params.assetId, user.id);
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
