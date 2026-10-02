import { Injectable } from '@nestjs/common';
import {
  AlbumAssetMime,
  MAX_ALBUM_ASSET_SIZE_BYTES,
  UploadAlbumAssetFieldsSchema,
  type AlbumAssetContract,
} from '@irec/contracts';

import {
  extractMultipartBoundary,
  parseMultipart,
  validationError,
} from '../http/multipart-stream.js';
import { GoogleDriveUploadService } from '../storage/google-drive-upload.service.js';
import { AlbumAssetsService } from './album-assets.service.js';

export interface StreamingUploadOptions {
  /** Test hook: forwarded to the Drive session to prove multi-PUT streaming. */
  chunkBytes?: number;
}

/**
 * Multipart upload orchestrator: pending row first, then a Drive resumable
 * session fed straight from the request stream (bounded chunks, no whole
 * file buffering), provider verify, and only then finalize to ready.
 * Any provider failure lands the asset in an explicit failed state.
 */
@Injectable()
export class AlbumAssetUploadService {
  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly drive: GoogleDriveUploadService,
  ) {}

  async uploadStreaming(
    albumId: string,
    uploaderId: string,
    source: AsyncIterable<Buffer | Uint8Array>,
    contentType: string | undefined,
    options: StreamingUploadOptions = {},
  ): Promise<AlbumAssetContract> {
    const boundary = extractMultipartBoundary(contentType);
    if (!boundary) {
      throw validationError(
        'La subida requiere multipart/form-data con boundary.',
      );
    }

    const fields = new Map<string, string>();
    let pending: AlbumAssetContract | null = null;
    let upload: {
      append(chunk: Buffer): Promise<void>;
      finish(totalBytes: number): Promise<{ providerFileId: string }>;
      cancel(): Promise<void>;
    } | null = null;
    let declaredSize = 0;
    let streamedBytes = 0;
    let fileSeen = false;

    const destroySource = (): void => {
      const destroyable = source as Partial<{ destroy(err?: Error): void }>;
      if (typeof destroyable.destroy === 'function') {
        try {
          destroyable.destroy();
        } catch {
          // Best effort: the socket is already being torn down.
        }
      }
    };

    const failAfterPending = async (error: unknown): Promise<never> => {
      destroySource();
      if (upload) {
        try {
          await upload.cancel();
        } catch {
          // Cancellation is advisory; the failure below is authoritative.
        }
      }
      if (pending) {
        try {
          await this.assets.markFailed(pending.id, uploaderId);
        } catch {
          // The original provider/client error carries the status code.
        }
      }
      throw error;
    };

    try {
      for await (const event of parseMultipart(source, boundary)) {
        switch (event.kind) {
          case 'field': {
            if (fileSeen) {
              throw validationError(
                'Los campos deben enviarse antes del archivo.',
              );
            }
            if (!fields.has(event.name)) fields.set(event.name, event.value);
            break;
          }
          case 'fileStart': {
            fileSeen = true;
            if (event.head.fieldName !== 'file') {
              throw validationError('El archivo debe enviarse en la parte `file`.');
            }
            const mime = AlbumAssetMime.safeParse(event.head.mimeType);
            if (!mime.success) {
              throw validationError(
                'Tipo de archivo no permitido: solo jpeg, png, webp o mp4.',
              );
            }
            const originalName = sanitizeOriginalName(event.head.filename);
            if (!originalName) {
              throw validationError('El nombre del archivo es invalido.');
            }
            const parsed = UploadAlbumAssetFieldsSchema.safeParse({
              storageConnectionId: fields.get('storageConnectionId'),
              sizeBytes: fields.get('sizeBytes'),
            });
            if (!parsed.success) {
              throw validationError(
                'La subida requiere storageConnectionId y sizeBytes validos antes del archivo.',
              );
            }
            declaredSize = parsed.data.sizeBytes;
            // Tenant + membership + READY guards run before any provider byte.
            pending = await this.assets.createPending(albumId, uploaderId, {
              storageConnectionId: parsed.data.storageConnectionId,
              mimeType: mime.data,
              originalName,
              sizeBytes: declaredSize,
            });
            try {
              const begun = await this.drive.beginResumableUpload({
                connectionId: parsed.data.storageConnectionId,
                ownerId: uploaderId,
                fileName: originalName,
                mimeType: mime.data,
                chunkBytes: options.chunkBytes,
              });
              upload = begun.upload;
            } catch (error) {
              await failAfterPending(error);
            }
            break;
          }
          case 'chunk': {
            if (!pending || !upload) {
              throw validationError('El cuerpo multipart es invalido.');
            }
            streamedBytes += event.data.length;
            if (
              streamedBytes > declaredSize ||
              streamedBytes > MAX_ALBUM_ASSET_SIZE_BYTES
            ) {
              await failAfterPending(
                validationError('El archivo supera el tamano declarado.'),
              );
            }
            const piece = Buffer.isBuffer(event.data)
              ? event.data
              : Buffer.from(event.data);
            try {
              await upload.append(piece);
            } catch (error) {
              await failAfterPending(error);
            }
            break;
          }
          case 'fileEnd': {
            if (!pending || !upload) {
              throw validationError('El cuerpo multipart es invalido.');
            }
            if (event.bytes === 0) {
              await failAfterPending(
                validationError('El archivo no contiene bytes.'),
              );
            }
            if (event.bytes !== declaredSize) {
              await failAfterPending(
                validationError(
                  'El contenido no coincide con el tamano declarado.',
                ),
              );
            }
            let providerFileId: string;
            try {
              ({ providerFileId } = await upload.finish(event.bytes));
            } catch (error) {
              await failAfterPending(error);
              throw error;
            }
            // Verify-before-finalize: finish() only resolves for a provider
            // file whose id/size/mime were read back. Ready is set here, never before.
            return await this.assets.finalizeAfterVerify(pending.id, uploaderId, {
              providerFileId,
            });
          }
          case 'done': {
            break;
          }
        }
      }
    } catch (error) {
      if (pending) await failAfterPending(error);
      destroySource();
      throw error;
    }

    destroySource();
    if (!fileSeen || !pending) {
      throw validationError('La solicitud multipart no contiene el archivo.');
    }
    // Unreachable: fileEnd always returns or throws. Guards the type checker.
    throw validationError('La subida no pudo completarse.');
  }
}

function sanitizeOriginalName(raw: string): string | null {
  const base = raw.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim() ?? '';
  if (!base || base === '.' || base === '..' || base.length > 255) return null;
  return base;
}
