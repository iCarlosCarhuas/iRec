import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  AlbumAssetParamsSchema,
  AlbumIdParamsSchema,
  CreateAlbumAssetInput,
  type AlbumAssetParams,
  type AlbumIdParams,
  type CreateAlbumAssetInput as CreateAlbumAssetInputType,
} from '@irec/contracts';

import { AuthService } from '../auth/auth.service.js';
import type { SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { AlbumAssetsService } from './album-assets.service.js';

const ACCESS_COOKIE = 'irec_access';
const REFRESH_COOKIE = 'irec_refresh';
const TRUSTED_COOKIE = 'irec_trusted';

@Controller('albums/:albumId/assets')
export class AlbumAssetsController {
  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
    @Body(new ZodValidationPipe(CreateAlbumAssetInput))
    body: CreateAlbumAssetInputType,
  ) {
    const user = await this.requireSession(req, res);
    return this.assets.createPending(params.albumId, user.id, body);
  }

  @Get()
  async list(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    const user = await this.optionalSession(req, res);
    return this.assets.listByAlbum(params.albumId, user?.id);
  }

  @Delete(':assetId')
  async remove(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
  ) {
    const user = await this.requireSession(req, res);
    return this.assets.requestDelete(params.albumId, params.assetId, user.id);
  }

  private async requireSession(req: Request, res: Response): Promise<SessionPayload> {
    const session = await this.optionalSession(req, res);
    if (!session) throw new UnauthorizedException();
    return session;
  }

  private async optionalSession(req: Request, res: Response): Promise<SessionPayload | null> {
    const result = await this.auth.getSession(
      req.cookies?.[ACCESS_COOKIE],
      req.cookies?.[REFRESH_COOKIE],
      req.cookies?.[TRUSTED_COOKIE],
    );
    if (!result.body.authenticated) return null;
    if (result.accessToken && result.refreshToken) {
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result.body.user;
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...this.baseCookie(),
      maxAge: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS') * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.baseCookie(),
      maxAge: this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS') * 1000,
    });
  }

  private baseCookie(): { httpOnly: true; secure: boolean; sameSite: 'lax'; path: string } {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      path: '/',
    };
  }
}
