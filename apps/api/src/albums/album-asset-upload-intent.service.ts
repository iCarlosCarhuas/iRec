import { Injectable } from '@nestjs/common';
import type { AlbumAssetUploadMimeType } from '@irec/contracts';

import { RedisService } from '../redis/redis.service.js';
import { CryptoService } from '../security/crypto.service.js';
import { PHOTO_UPLOAD_INTENT_TTL_SECONDS } from './album-asset-upload.policy.js';

export type AlbumAssetUploadIntent = {
  assetId: string;
  albumId: string;
  uploaderId: string;
  ownerId: string;
  storageConnectionId: string;
  objectKey: string;
  originalFilename: string;
  mimeType: AlbumAssetUploadMimeType;
  sizeBytes: number;
};

@Injectable()
export class AlbumAssetUploadIntentService {
  constructor(
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
  ) {}

  async create(
    intent: AlbumAssetUploadIntent,
  ): Promise<{ uploadToken: string; completeBy: Date }> {
    await this.redis.connect();

    const uploadToken = this.crypto.randomToken(32);
    const completeBy = new Date(
      Date.now() + PHOTO_UPLOAD_INTENT_TTL_SECONDS * 1000,
    );

    await this.redis.client.set(
      this.key(uploadToken),
      JSON.stringify(intent),
      'EX',
      PHOTO_UPLOAD_INTENT_TTL_SECONDS,
    );

    return { uploadToken, completeBy };
  }

  async get(uploadToken: string): Promise<AlbumAssetUploadIntent | null> {
    await this.redis.connect();
    const raw = await this.redis.client.get(this.key(uploadToken));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AlbumAssetUploadIntent;
    } catch {
      return null;
    }
  }

  async delete(uploadToken: string): Promise<void> {
    await this.redis.connect();
    await this.redis.client.del(this.key(uploadToken));
  }

  private key(uploadToken: string): string {
    return `irec:photo-upload:${this.crypto.hashOpaque(uploadToken)}`;
  }
}
