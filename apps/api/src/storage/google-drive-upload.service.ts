import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageConnectionService } from './storage-connection.service.js';
import {
  badDriveResponse,
  driveReconnect,
  isRecord,
  readDriveJson,
  refreshGoogleDriveAccessToken,
} from './google-drive-token.js';

const RESUMABLE_ENDPOINT =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const VERIFY_FIELDS = 'id,name,mimeType,size,parents';

// 256KB multiples are required by Drive for multi-chunk resumable uploads.
export const DRIVE_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;

export interface BeginResumableUploadInput {
  connectionId: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  /** Test hook: smaller chunks prove multi-PUT streaming. Must stay positive. */
  chunkBytes?: number;
}

export interface VerifiedDriveFile {
  providerFileId: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Single Drive resumable-upload session: coalesces streamed bytes into
 * bounded chunk PUTs (Content-Range .../*) and performs one final PUT with
 * the total length, followed by a metadata read that verifies id/size/mime
 * BEFORE the caller may mark any asset ready.
 *
 * Credentials stay ephemeral: the access token is refreshed per session,
 * held only in memory, and never persisted, logged, or surfaced in errors.
 */
export class ResumableDriveUpload {
  private pending: Buffer = Buffer.alloc(0);
  private sentBytes = 0;
  private finished = false;
  private cancelled = false;

  constructor(
    private readonly sessionUri: string,
    private readonly accessToken: string,
    private readonly expectedMimeType: string,
    private readonly chunkBytes: number,
  ) {}

  async append(chunk: Buffer): Promise<void> {
    this.assertOpen();
    if (chunk.length === 0) return;
    this.pending =
      this.pending.length > 0 ? Buffer.concat([this.pending, chunk]) : chunk;
    while (this.pending.length >= this.chunkBytes) {
      const piece = this.pending.subarray(0, this.chunkBytes);
      await this.put(piece, false);
      this.pending = this.pending.subarray(this.chunkBytes);
    }
  }

  async finish(totalBytes: number): Promise<VerifiedDriveFile> {
    this.assertOpen();
    if (!Number.isInteger(totalBytes) || totalBytes <= 0) {
      throw new BadRequestException({
        type: 'https://irec.app/problems/empty-upload',
        title: 'Empty upload',
        status: 400,
        detail: 'El archivo no contiene bytes.',
      });
    }
    if (this.sentBytes + this.pending.length !== totalBytes) {
      throw new BadRequestException({
        type: 'https://irec.app/problems/upload-size-mismatch',
        title: 'Upload size mismatch',
        status: 400,
        detail: 'El contenido no coincide con el tamano declarado.',
      });
    }
    const fileId = await this.put(this.pending, true, totalBytes);
    if (!fileId) throw badDriveResponse();
    this.pending = Buffer.alloc(0);
    this.finished = true;
    return this.verify(fileId, totalBytes);
  }

  /** Best effort: releases the provider session; never throws. */
  async cancel(): Promise<void> {
    if (this.finished || this.cancelled) return;
    this.cancelled = true;
    try {
      await fetch(this.sessionUri, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${this.accessToken}` },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Session expiry reaps abandoned uploads; cancellation is advisory.
    }
  }

  private assertOpen(): void {
    if (this.finished || this.cancelled) {
      throw new BadRequestException({
        type: 'https://irec.app/problems/upload-closed',
        title: 'Upload closed',
        status: 400,
        detail: 'La subida ya termino o fue cancelada.',
      });
    }
  }

  /**
   * PUTs one piece. Non-final chunks use an unknown total (`.../*`) so the
   * total length is only required once, at the end. Returns the provider
   * file id for the final PUT.
   */
  private async put(
    piece: Buffer,
    final: boolean,
    totalBytes?: number,
  ): Promise<string | null> {
    const start = this.sentBytes;
    // A file that lands exactly on a chunk edge finalizes with an empty
    // body (`bytes */total`); Drive already holds every byte.
    const range =
      piece.length === 0 && final
        ? `bytes */${totalBytes}`
        : final
          ? `bytes ${start}-${start + piece.length - 1}/${totalBytes}`
          : `bytes ${start}-${start + piece.length - 1}/*`;
    let response: Response;
    try {
      response = await fetch(this.sessionUri, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          'content-length': String(piece.length),
          'content-range': range,
        },
        body: piece,
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new BadGatewayException(
        'Google Drive no pudo recibir el contenido; intentalo de nuevo.',
      );
    }
    if (!final && response.status === 308) {
      this.sentBytes += piece.length;
      return null;
    }
    if (final && (response.status === 200 || response.status === 201)) {
      const payload = await readDriveJson(response);
      if (
        isRecord(payload) &&
        typeof payload.id === 'string' &&
        payload.id.length > 0
      ) {
        this.sentBytes += piece.length;
        return payload.id;
      }
      throw badDriveResponse();
    }
    if (response.status === 401) throw driveReconnect();
    if (response.status === 403 || response.status === 404) {
      throw new ForbiddenException(
        'Google Drive no permite escribir con los permisos otorgados.',
      );
    }
    if (response.status === 308 && final) throw badDriveResponse();
    if (response.status === 429 || response.status >= 500) {
      throw new BadGatewayException(
        'Google Drive no esta disponible; intentalo de nuevo.',
      );
    }
    if (response.status >= 400) {
      throw new BadGatewayException(
        'Google Drive rechazo el contenido de la subida.',
      );
    }
    throw badDriveResponse();
  }

  private async verify(
    fileId: string,
    totalBytes: number,
  ): Promise<VerifiedDriveFile> {
    let response: Response;
    try {
      const url = new URL(
        `${FILES_ENDPOINT}/${encodeURIComponent(fileId)}`,
      );
      url.searchParams.set('fields', VERIFY_FIELDS);
      response = await fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          accept: 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new BadGatewayException(
        'Google Drive no esta disponible; intentalo de nuevo.',
      );
    }
    if (response.status === 401) throw driveReconnect();
    if (response.status === 403 || response.status === 404) {
      throw new ForbiddenException(
        'Google Drive no permite leer el archivo subido.',
      );
    }
    const payload = await readDriveJson(response);
    if (
      !isRecord(payload) ||
      payload.id !== fileId ||
      typeof payload.mimeType !== 'string' ||
      payload.mimeType.toLowerCase() !== this.expectedMimeType.toLowerCase()
    ) {
      throw badDriveResponse();
    }
    const size = Number(payload.size);
    if (!Number.isInteger(size) || size !== totalBytes) {
      throw badDriveResponse();
    }
    return {
      providerFileId: fileId,
      sizeBytes: size,
      mimeType: payload.mimeType,
    };
  }
}

@Injectable()
export class GoogleDriveUploadService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageConnectionService,
  ) {}

  /**
   * Refreshes an ephemeral access token for an owned READY connection and
   * opens a resumable session under its verified root. Foreign connections
   * are indistinguishable from missing ones (404); nothing is persisted.
   */
  async beginResumableUpload(
    input: BeginResumableUploadInput,
  ): Promise<{ upload: ResumableDriveUpload; rootId: string }> {
    const chunkBytes =
      input.chunkBytes && input.chunkBytes > 0
        ? Math.floor(input.chunkBytes)
        : DRIVE_UPLOAD_CHUNK_BYTES;
    const connection = await this.storage.getOwned(
      input.connectionId,
      input.ownerId,
    );
    if (!connection || connection.provider !== 'google_drive') {
      throw new NotFoundException({
        type: 'https://irec.app/problems/storage-connection-not-found',
        title: 'Storage connection not found',
        status: 404,
        detail: 'La conexion no existe o no esta disponible para esta sesion.',
      });
    }
    if (connection.status !== 'ready' || !connection.rootId) {
      throw new BadRequestException({
        type: 'https://irec.app/problems/storage-connection-not-ready',
        title: 'Storage connection not ready',
        status: 400,
        detail: 'La conexion debe estar verificada antes de subir contenido.',
      });
    }
    const envelope = await this.storage.getCredentialEnvelope(
      input.connectionId,
      input.ownerId,
    );
    if (!envelope) {
      throw new NotFoundException({
        type: 'https://irec.app/problems/storage-connection-not-found',
        title: 'Storage connection not found',
        status: 404,
        detail: 'La conexion no existe o no esta disponible para esta sesion.',
      });
    }
    const accessToken = await this.refreshAccessToken(envelope);
    let sessionUri: string;
    try {
      const response = await fetch(RESUMABLE_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-type': input.mimeType,
          accept: 'application/json',
        },
        body: JSON.stringify({
          name: input.fileName,
          mimeType: input.mimeType,
          parents: [connection.rootId],
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 401) throw driveReconnect();
      if (response.status === 403) {
        throw new ForbiddenException(
          'Google Drive no permite escribir con los permisos otorgados.',
        );
      }
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new BadGatewayException(
            'Google Drive no esta disponible; intentalo de nuevo.',
          );
        }
        throw new BadGatewayException(
          'Google Drive no pudo iniciar la subida.',
        );
      }
      const location = response.headers.get('location');
      if (!location) throw badDriveResponse();
      sessionUri = location;
      // Drain the initiation body so sockets are not leaked.
      await response.arrayBuffer().catch(() => undefined);
    } catch (error) {
      // Sanitized provider errors propagate untouched; transport failures
      // and aborts become 502 without provider or credential details.
      if (isHttpLike(error)) throw error;
      throw new BadGatewayException(
        'Google Drive no esta disponible; intentalo de nuevo.',
      );
    }
    return {
      upload: new ResumableDriveUpload(
        sessionUri,
        accessToken,
        input.mimeType,
        chunkBytes,
      ),
      rootId: connection.rootId,
    };
  }

  private async refreshAccessToken(envelope: string): Promise<string> {
    return refreshGoogleDriveAccessToken(
      (key) => this.config.get<string>(key),
      envelope,
    );
  }
}

function isHttpLike(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getStatus' in error &&
    typeof (error as { getStatus: unknown }).getStatus === 'function'
  );
}
