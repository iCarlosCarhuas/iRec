import {
  GoneException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AlbumAssetContract,
  CompleteAlbumAssetUploadInput,
  PresignAlbumAssetInput,
  PresignAlbumAssetResponse,
} from '@irec/contracts';

import { R2ObjectService } from '../storage/r2-object.service.js';
import { StorageConnectionService } from '../storage/storage.service.js';
import {
  buildAlbumAssetObjectKey,
  completedUploadMatches,
  PHOTO_UPLOAD_PRESIGN_TTL_SECONDS,
} from './album-asset-upload.policy.js';
import { AlbumAssetUploadIntentService } from './album-asset-upload-intent.service.js';
import { AlbumAssetsService } from './album-assets.service.js';

@Injectable()
export class AlbumAssetUploadService {
  constructor(
    private readonly assets: AlbumAssetsService,
    private readonly intents: AlbumAssetUploadIntentService,
    private readonly storage: StorageConnectionService,
    private readonly r2: R2ObjectService,
  ) {}

  async presign(
    albumId: string,
    uploaderId: string,
    input: PresignAlbumAssetInput,
  ): Promise<PresignAlbumAssetResponse> {
    const context = await this.assets.prepareUpload(albumId, uploaderId);
    const credentials = await this.storage.getOwnedCredentials(
      context.ownerId,
      context.storageConnectionId,
    );

    const assetId = randomUUID();
    const objectKey = buildAlbumAssetObjectKey(
      albumId,
      assetId,
      input.mimeType,
    );

    const signed = await this.r2.presignPut({
      credentials,
      objectKey,
      contentType: input.mimeType,
      expiresIn: PHOTO_UPLOAD_PRESIGN_TTL_SECONDS,
    });

    const intent = await this.intents.create({
      assetId,
      albumId,
      uploaderId,
      ownerId: context.ownerId,
      storageConnectionId: context.storageConnectionId,
      objectKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    return {
      assetId,
      uploadToken: intent.uploadToken,
      method: 'PUT',
      uploadUrl: signed.uploadUrl,
      headers: {
        'Content-Type': input.mimeType,
      },
      expiresAt: signed.expiresAt.toISOString(),
      completeBy: intent.completeBy.toISOString(),
    };
  }

  async complete(
    albumId: string,
    assetId: string,
    uploaderId: string,
    input: CompleteAlbumAssetUploadInput,
  ): Promise<AlbumAssetContract> {
    const alreadyCompleted = await this.assets.findCompletedForUploader(
      albumId,
      assetId,
      uploaderId,
    );
    if (alreadyCompleted) return alreadyCompleted;

    const intent = await this.intents.get(input.uploadToken);

    if (
      !intent ||
      intent.albumId !== albumId ||
      intent.assetId !== assetId ||
      intent.uploaderId !== uploaderId
    ) {
      throw new GoneException({
        type: 'https://irec.app/problems/photo-upload-intent-invalid',
        title: 'Photo upload intent invalid',
        status: 410,
        detail: 'La autorizacion de upload expiro o no corresponde a este asset.',
      });
    }

    const credentials = await this.storage.getOwnedCredentials(
      intent.ownerId,
      intent.storageConnectionId,
    );

    const head = await this.r2.headObject({
      credentials,
      objectKey: intent.objectKey,
    });

    if (
      !completedUploadMatches(
        {
          mimeType: intent.mimeType,
          sizeBytes: intent.sizeBytes,
        },
        head,
      )
    ) {
      throw new UnprocessableEntityException({
        type: 'https://irec.app/problems/photo-upload-metadata-mismatch',
        title: 'Photo upload metadata mismatch',
        status: 422,
        detail: 'El Content-Type o tamano real no coincide con el upload autorizado.',
      });
    }

    const asset = await this.assets.registerUploaded(albumId, uploaderId, {
      assetId: intent.assetId,
      storageConnectionId: intent.storageConnectionId,
      objectKey: intent.objectKey,
      originalFilename: intent.originalFilename,
      mimeType: intent.mimeType,
      sizeBytes: intent.sizeBytes,
      width: null,
      height: null,
      checksum: null,
      uploadedAt: head.lastModified ?? new Date(),
    });

    await this.intents.delete(input.uploadToken);
    return asset;
  }
}
