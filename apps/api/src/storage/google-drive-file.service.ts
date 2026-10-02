import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

import { StorageConnectionService } from './storage-connection.service.js';
import {
  badDriveResponse,
  driveReconnect,
  isRecord,
  readDriveJson,
  refreshGoogleDriveAccessToken,
} from './google-drive-token.js';

const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const METADATA_FIELDS = 'id,mimeType,size';
const REQUEST_TIMEOUT_MS = 60_000;

export interface DriveConnectionRef {
  connectionId: string;
  ownerId: string;
}

export interface DriveFileMetadata {
  providerFileId: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DriveByteRange {
  start: number;
  /** Inclusive end. Undefined means "to the end of the file". */
  end?: number;
}

export interface DriveMediaResult {
  status: 200 | 206;
  contentType: string;
  contentLength: number;
  contentRange: string | null;
  totalLength: number;
  body: Readable;
}

/**
 * Control-flow signal for provider deletes: the Drive file is already gone,
 * so the caller still finalizes the local row as deleted (with a warning)
 * instead of failing. Never reaches the HTTP filter.
 */
export class DriveFileGoneError extends Error {
  constructor(readonly providerFileId: string) {
    super('Drive file is already gone');
    this.name = 'DriveFileGoneError';
  }
}

/**
 * Per-connection Drive read/delete client. Every call resolves credentials
 * through the connection named in the asset (never a session-level or
 * same-drive assumption), refreshes an ephemeral access token held only in
 * memory, and maps provider failures to sanitized HTTP errors. Drive files
 * are never made public and refresh material never leaves this service.
 */
@Injectable()
export class GoogleDriveFileService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageConnectionService,
  ) {}

  /**
   * Reads back id/mime/size before streaming so drift (renamed, replaced,
   * or resized provider files) fails closed with a 502 instead of serving
   * bytes the local row does not describe.
   */
  async getMetadata(
    ref: DriveConnectionRef,
    providerFileId: string,
  ): Promise<DriveFileMetadata> {
    const accessToken = await this.accessToken(ref);
    let response: Response;
    try {
      const url = new URL(
        `${FILES_ENDPOINT}/${encodeURIComponent(providerFileId)}`,
      );
      url.searchParams.set('fields', METADATA_FIELDS);
      url.searchParams.set('supportsAllDrives', 'true');
      response = await fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw providerUnavailable();
    }
    if (response.status === 401) throw driveReconnect();
    if (response.status === 403) {
      throw new ForbiddenException('Google Drive no permite leer este archivo.');
    }
    if (response.status === 404 || response.status === 400) {
      // A ready row pointing at a missing provider file is provider drift,
      // not a local 404: fail closed without leaking provider details.
      throw new BadGatewayException(
        'Google Drive no pudo entregar el contenido.',
      );
    }
    if (response.status === 429 || response.status >= 500) {
      throw providerUnavailable();
    }
    if (!response.ok) {
      throw new BadGatewayException('Google Drive rechazo la solicitud del archivo.');
    }
    const payload = await readDriveJson(response);
    if (
      !isRecord(payload) ||
      payload.id !== providerFileId ||
      typeof payload.mimeType !== 'string'
    ) {
      throw badDriveResponse();
    }
    const size = Number(payload.size);
    if (!Number.isInteger(size) || size < 0) throw badDriveResponse();
    return { providerFileId, mimeType: payload.mimeType, sizeBytes: size };
  }

  /**
   * Streams provider bytes without buffering the whole file. A byte range
   * is forwarded to Drive untouched; Drive owns 206/416 semantics and the
   * caller mirrors them.
   */
  async downloadMedia(
    ref: DriveConnectionRef,
    providerFileId: string,
    range?: DriveByteRange,
  ): Promise<DriveMediaResult> {
    const accessToken = await this.accessToken(ref);
    let response: Response;
    try {
      const url = new URL(
        `${FILES_ENDPOINT}/${encodeURIComponent(providerFileId)}`,
      );
      url.searchParams.set('alt', 'media');
      url.searchParams.set('supportsAllDrives', 'true');
      response = await fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(range
            ? {
                range: `bytes=${range.start}-${range.end ?? ''}`,
              }
            : {}),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw providerUnavailable();
    }
    if (response.status === 401) throw driveReconnect();
    if (response.status === 403) {
      throw new ForbiddenException('Google Drive no permite leer este archivo.');
    }
    if (response.status === 404 || response.status === 400) {
      throw new BadGatewayException(
        'Google Drive no pudo entregar el contenido.',
      );
    }
    if (response.status === 416) {
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
    if (response.status === 429 || response.status >= 500) {
      throw providerUnavailable();
    }
    if (response.status !== 200 && response.status !== 206) {
      throw new BadGatewayException('Google Drive rechazo la solicitud del archivo.');
    }
    if (!response.body) throw badDriveResponse();
    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const contentRange = response.headers.get('content-range');
    if (response.status === 206) {
      const parsed = contentRange ? parseContentRange(contentRange) : null;
      if (!parsed) throw badDriveResponse();
      return {
        status: 206,
        contentType,
        contentLength: parsed.length,
        contentRange,
        totalLength: parsed.total,
        body: Readable.fromWeb(response.body),
      };
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (!Number.isInteger(contentLength) || contentLength < 0) {
      throw badDriveResponse();
    }
    return {
      status: 200,
      contentType,
      contentLength,
      contentRange: null,
      totalLength: contentLength,
      body: Readable.fromWeb(response.body),
    };
  }

  /**
   * Permanently deletes the provider file (not trash: an explicit delete
   * must free quota, while the local `deleted` row keeps the audit trail).
   * A missing provider file throws DriveFileGoneError so the caller can
   * still finalize the local row; every other provider failure is a
   * sanitized 502 and the local row stays untouched.
   */
  async deleteFile(
    ref: DriveConnectionRef,
    providerFileId: string,
  ): Promise<{ success: true }> {
    const accessToken = await this.accessToken(ref);
    let response: Response;
    try {
      const url = new URL(
        `${FILES_ENDPOINT}/${encodeURIComponent(providerFileId)}`,
      );
      url.searchParams.set('supportsAllDrives', 'true');
      response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw providerUnavailable();
    }
    if (response.status === 401) throw driveReconnect();
    if (response.status === 404) throw new DriveFileGoneError(providerFileId);
    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      // Local authz already passed: a provider refusal here is a
      // provider-side failure, hence 502 (never a local 403).
      throw providerUnavailable();
    }
    if (response.status !== 200 && response.status !== 204) {
      throw new BadGatewayException(
        'Google Drive no pudo eliminar el contenido.',
      );
    }
    await response.arrayBuffer().catch(() => undefined);
    return { success: true };
  }

  /**
   * Resolves the named connection with an owner predicate (foreign
   * connections read as missing, 404) and refreshes an ephemeral token.
   * Nothing credential-shaped is persisted, logged, or thrown.
   */
  private async accessToken(ref: DriveConnectionRef): Promise<string> {
    const connection = await this.storage.getOwned(
      ref.connectionId,
      ref.ownerId,
    );
    if (!connection || connection.provider !== 'google_drive') {
      throw new NotFoundException({
        type: 'https://irec.app/problems/storage-connection-not-found',
        title: 'Storage connection not found',
        status: 404,
        detail: 'La conexion no existe o no esta disponible para esta sesion.',
      });
    }
    if (connection.status !== 'ready') {
      throw new ConflictException({
        type: 'https://irec.app/problems/storage-connection-not-ready',
        title: 'Storage connection not ready',
        status: 409,
        detail: 'La conexion debe estar verificada antes de leer el contenido.',
      });
    }
    const envelope = await this.storage.getCredentialEnvelope(
      ref.connectionId,
      ref.ownerId,
    );
    if (!envelope) {
      throw new NotFoundException({
        type: 'https://irec.app/problems/storage-connection-not-found',
        title: 'Storage connection not found',
        status: 404,
        detail: 'La conexion no existe o no esta disponible para esta sesion.',
      });
    }
    return refreshGoogleDriveAccessToken(
      (key) => this.config.get<string>(key),
      envelope,
    );
  }
}

function providerUnavailable(): BadGatewayException {
  return new BadGatewayException(
    'Google Drive no esta disponible; intentalo de nuevo.',
  );
}

function parseContentRange(
  value: string,
): { length: number; total: number } | null {
  const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(value.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = match[3] === '*' ? NaN : Number(match[3]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return null;
  }
  if (Number.isNaN(total)) return null;
  return { length: end - start + 1, total };
}
