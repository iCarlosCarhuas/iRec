import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { AlbumAssetContentService } from './album-asset-content.service.js';
import { AlbumAssetUploadService } from './album-asset-upload.service.js';
import { AlbumAssetsService } from './album-assets.service.js';

const ACCESS_COOKIE = 'irec_access';
const REFRESH_COOKIE = 'irec_refresh';
const TRUSTED_COOKIE = 'irec_trusted';

@Controller('albums/:albumId/assets')
export class AlbumAssetsController {
  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly uploads: AlbumAssetUploadService,
    private readonly assetContent: AlbumAssetContentService,
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

  /**
   * Streaming resumable upload: multipart fields (storageConnectionId,
   * sizeBytes) first, then the `file` part piped straight to Drive with no
   * whole-file buffering. The asset only becomes ready after provider verify.
   */
  @Post('upload')
  @HttpCode(201)
  async upload(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    const user = await this.requireSession(req, res);
    return this.uploads.uploadStreaming(
      params.albumId,
      user.id,
      req,
      req.headers['content-type'],
    );
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

  /**
   * Single-asset metadata (no bytes): same visibility rules as the list,
   * so private albums stay hidden with 404. Always carries
   * storageConnectionId + providerFileId for multi-drive galleries.
   */
  @Get(':assetId')
  async getOne(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
  ) {
    const user = await this.optionalSession(req, res);
    return this.assets.getOne(params.albumId, params.assetId, user?.id);
  }

  /**
   * Byte proxy: authz first, then Drive bytes streamed with the asset mime
   * and single-range (206) support for video. The Drive file is never made
   * public and no URL tokens are issued; headers are set only after the
   * provider answers, so provider failures still surface as problem+json.
   */
  @Get(':assetId/content')
  async content(
    @Req() req: Request,
    @Res() res: Response,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
  ): Promise<void> {
    const user = await this.optionalSession(req, res);
    const result = await this.assetContent.streamContent(
      params.albumId,
      params.assetId,
      user?.id,
      req.headers.range,
    );
    res.status(result.status);
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-length', String(result.contentLength));
    res.setHeader('accept-ranges', 'bytes');
    res.setHeader(
      'content-disposition',
      `inline; filename="${sanitizeDispositionFilename(result.fileName)}"`,
    );
    if (result.contentRange) {
      res.setHeader('content-range', result.contentRange);
    }
    res.setHeader('cache-control', 'private, max-age=60');
    result.body.on('error', () => {
      try {
        res.destroy();
      } catch {
        // The socket is already gone; nothing left to report.
      }
    });
    result.body.pipe(res);
  }

  @Delete(':assetId')
  async remove(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
  ) {
    const user = await this.requireSession(req, res);
    return this.assetContent.deleteAsset(params.albumId, params.assetId, user.id);
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

function sanitizeDispositionFilename(raw: string): string {
  const cleaned = raw
    .split(/[\\/]/)
    .pop()
    ?.replace(/["\u0000-\u001f\u007f]/g, '')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'asset';
  return cleaned.slice(0, 180);
}
