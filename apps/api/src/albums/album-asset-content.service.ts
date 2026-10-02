import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Readable } from 'node:stream';

import { AlbumAssetsService } from './album-assets.service.js';
import {
  DriveFileGoneError,
  type DriveByteRange,
  GoogleDriveFileService,
} from '../storage/google-drive-file.service.js';

export interface AssetContentStream {
  status: 200 | 206;
  mimeType: string;
  contentLength: number;
  contentRange: string | null;
  totalLength: number;
  fileName: string;
  body: Readable;
}

/**
 * Provider orchestration for album assets: secure reads and reconciled
 * deletes. Album visibility + membership + asset ownership are always
 * validated before any provider call, and the Drive call always targets
 * the asset's own storageConnectionId (multi-drive correct: asset A in
 * Drive A and asset B in Drive B refresh different connections).
 */
@Injectable()
export class AlbumAssetContentService {
  private readonly logger = new Logger(AlbumAssetContentService.name);

  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly drive: GoogleDriveFileService,
  ) {}

  /**
   * Streams provider bytes after read authz. The Drive file is never made
   * public and no token/refresh material is returned — only bytes plus
   * transport headers. Video seeking works via single-range requests
   * (206 + Content-Range); anything else falls back to a full 200.
   */
  async streamContent(
    albumId: string,
    assetId: string,
    viewerId: string | undefined,
    rangeHeader: string | undefined,
  ): Promise<AssetContentStream> {
    const asset = await this.assets.getOne(albumId, assetId, viewerId);

    if (asset.status !== 'ready' || !asset.providerFileId) {
      throw new HttpException(
        {
          type: 'https://irec.app/problems/album-asset-not-ready',
          title: 'Asset not ready',
          status: 409,
          detail: 'El contenido aun no esta disponible para lectura.',
        },
        409,
      );
    }

    const range = parseAssetRangeHeader(rangeHeader, asset.sizeBytes);
    const ref = {
      connectionId: asset.storageConnectionId,
      ownerId: asset.uploadedBy,
    };

    // Metadata first: a ready row pointing at a renamed, replaced, or
    // resized provider file fails closed instead of serving foreign bytes.
    const metadata = await this.drive.getMetadata(ref, asset.providerFileId);
    if (
      metadata.sizeBytes !== asset.sizeBytes ||
      metadata.mimeType.toLowerCase() !== asset.mimeType.toLowerCase()
    ) {
      throw new BadGatewayException(
        'Google Drive devolvio una respuesta invalida.',
      );
    }

    const media = await this.drive.downloadMedia(
      ref,
      asset.providerFileId,
      range ?? undefined,
    );

    return {
      status: media.status,
      // Local mime wins: it passed the allowlist at upload and the verify
      // above just confirmed the provider agrees.
      mimeType: asset.mimeType,
      contentLength: media.contentLength,
      contentRange: media.contentRange,
      totalLength: asset.sizeBytes,
      fileName: asset.originalName,
      body: media.body,
    };
  }

  /**
   * Authz first, provider delete second, local finalize last. A provider
   * file that is already gone still finalizes the local row as deleted
   * (with a server-side warning); any other provider failure propagates
   * as a sanitized error and the local row keeps its status — never a
   * silent half-delete. Already-deleted rows succeed without provider I/O.
   */
  async deleteAsset(
    albumId: string,
    assetId: string,
    requesterId: string,
  ): Promise<{ success: true }> {
    const target = await this.assets.authorizeDelete(
      albumId,
      assetId,
      requesterId,
    );

    if (target.status === 'deleted') return { success: true };

    if (target.providerFileId) {
      try {
        await this.drive.deleteFile(
          {
            connectionId: target.storageConnectionId,
            ownerId: target.uploadedBy,
          },
          target.providerFileId,
        );
      } catch (error) {
        if (error instanceof DriveFileGoneError) {
          this.logger.warn(
            `Drive file already gone for asset ${target.id}; finalizing local delete.`,
          );
        } else {
          throw error;
        }
      }
    }

    return this.assets.finalizeDeleted(target);
  }
}

/**
 * Single-range parser (`bytes=start-end`, `bytes=start-`, `bytes=-suffix`).
 * Missing, malformed, or multi-range headers return null (caller serves a
 * full 200); a satisfiable range is clamped; start >= total throws 416.
 */
export function parseAssetRangeHeader(
  header: string | undefined,
  total: number,
): DriveByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const startText = match[1] ?? '';
  const endText = match[2] ?? '';
  if (startText === '' && endText === '') return null;

  let start: number;
  let end: number | undefined;
  if (startText === '') {
    // Suffix range: last N bytes.
    const suffix = Number(endText);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    if (suffix >= total) return { start: 0 };
    start = total - suffix;
    end = total - 1;
  } else {
    start = Number(startText);
    if (!Number.isInteger(start) || start < 0) return null;
    if (endText !== '') {
      end = Number(endText);
      if (!Number.isInteger(end) || end < start) return null;
      if (end >= total) end = total - 1;
    }
  }

  if (start >= total) {
    throw new HttpException(
      {
        type: 'https://irec.app/problems/range-not-satisfiable',
        title: 'Range Not Satisfiable',
        status: 416,
        detail: 'El rango solicitado esta fuera del contenido.',
      },
      416,
    );
  }

  return end === undefined ? { start } : { start, end };
}
