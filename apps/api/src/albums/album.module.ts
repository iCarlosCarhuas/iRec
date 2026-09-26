import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AlbumController } from './album.controller.js';
import { AlbumAssetUploadIntentService } from './album-asset-upload-intent.service.js';
import { AlbumAssetUploadService } from './album-asset-upload.service.js';
import { AlbumAssetsController } from './album-assets.controller.js';
import { AlbumAssetsService } from './album-assets.service.js';
import { AlbumMembersController } from './album-members.controller.js';
import { AlbumMembersService } from './album-members.service.js';
import { AlbumProposalsController } from './album-proposals.controller.js';
import { AlbumProposalsService } from './album-proposals.service.js';
import { AlbumService } from './album.service.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [
    AlbumController,
    AlbumAssetsController,
    AlbumMembersController,
    AlbumProposalsController,
  ],
  providers: [
    AlbumService,
    AlbumAssetsService,
    AlbumAssetUploadIntentService,
    AlbumAssetUploadService,
    AlbumMembersService,
    AlbumProposalsService,
  ],
  exports: [AlbumAssetsService],
})
export class AlbumModule {}
