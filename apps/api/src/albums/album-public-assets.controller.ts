import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AlbumAssetParamsSchema,
  AlbumIdParamsSchema,
  type AlbumAssetParams,
  type AlbumIdParams,
} from '@irec/contracts';

import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { AlbumAssetContentService } from './album-asset-content.service.js';
import { AlbumAssetsService } from './album-assets.service.js';

/**
 * Anonymous public gallery surface. No session is required or trusted:
 * only public albums serve only ready assets, with the same per-asset
 * connection + provider file ids and no uploader emails or tokens.
 * Private albums (or QR possession without members/accept) read as 404.
 */
@Controller('albums/:albumId/public-assets')
export class AlbumPublicAssetsController {
  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly assetContent: AlbumAssetContentService,
  ) {}

  @Get()
  async list(
    @Param(new ZodValidationPipe(AlbumIdParamsSchema))
    params: AlbumIdParams,
  ) {
    return this.assets.listPublicAssets(params.albumId);
  }

  /**
   * Anonymous byte proxy for public ready assets. Same mime/range/inline
   * behavior as the private proxy; the Drive file is never made public.
   * Range comes from headers only — never from query tokens or QR payloads.
   */
  @Get(':assetId/content')
  async content(
    @Req() req: Request,
    @Res() res: Response,
    @Param(new ZodValidationPipe(AlbumAssetParamsSchema))
    params: AlbumAssetParams,
  ): Promise<void> {
    const result = await this.assetContent.streamPublicContent(
      params.albumId,
      params.assetId,
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
    res.setHeader('cache-control', 'public, max-age=60');
    result.body.on('error', () => {
      try {
        res.destroy();
      } catch {
        // The socket is already gone; nothing left to report.
      }
    });
    result.body.pipe(res);
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
