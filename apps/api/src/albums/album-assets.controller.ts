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
  AlbumAssetParamsSchema,
  AlbumIdParamsSchema,
  CompleteAlbumAssetUploadInput,
  PresignAlbumAssetInput,
  type AlbumAssetParams,
  type AlbumIdParams,
  type CompleteAlbumAssetUploadInput as CompleteAlbumAssetUploadInputType,
  type PresignAlbumAssetInput as PresignAlbumAssetInputType,
} from '@irec/contracts';

import { SessionService, type SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { RateLimitService } from '../security/rate-limit.service.js';
import { AlbumAssetUploadService } from './album-asset-upload.service.js';
import { AlbumAssetsService } from './album-assets.service.js';

const ACCESS_COOKIE = 'irec_access';

@Controller('albums/:albumId/assets')
export class AlbumAssetsController {
  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly uploads: AlbumAssetUploadService,
    private readonly sessions: SessionService,
    private readonly rateLimit: RateLimitService,
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

  @Post('presign')
  @HttpCode(HttpStatus.OK)
  async presign(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
    @Body(new ZodValidationPipe(PresignAlbumAssetInput))
    body: PresignAlbumAssetInputType,
  ) {
    const user = await this.requireSession(req);

    await this.rateLimit.consume('photo-presign-user', user.id, 20, 300);
    await this.rateLimit.consume(
      'photo-presign-ip',
      req.ip ?? 'unknown',
      60,
      300,
    );

    return this.uploads.presign(params.albumId, user.id, body);
  }

  @Post(':assetId/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Req() req: Request,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
    @Body(new ZodValidationPipe(CompleteAlbumAssetUploadInput))
    body: CompleteAlbumAssetUploadInputType,
  ) {
    const user = await this.requireSession(req);

    await this.rateLimit.consume('photo-complete-user', user.id, 40, 300);
    await this.rateLimit.consume(
      'photo-complete-ip',
      req.ip ?? 'unknown',
      120,
      300,
    );

    return this.uploads.complete(
      params.albumId,
      params.assetId,
      user.id,
      body,
    );
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
