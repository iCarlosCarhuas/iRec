import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { SecurityModule } from '../security/security.module.js';

import { GoogleDriveOAuthController } from './google-drive-oauth.controller.js';
import { GoogleDriveFileService } from './google-drive-file.service.js';
import { GoogleDriveOAuthService } from './google-drive-oauth.service.js';
import { GoogleDriveRootService } from './google-drive-root.service.js';
import { GoogleDriveUploadService } from './google-drive-upload.service.js';
import { StorageConnectionService } from './storage-connection.service.js';
import { StorageController } from './storage.controller.js';
import { StorageProviderRegistry } from './storage-provider.registry.js';

@Module({
  imports: [
    AuthModule,
    RedisModule,
    SecurityModule,
  ],
  controllers: [
    GoogleDriveOAuthController,
    StorageController,
  ],
  providers: [
    GoogleDriveOAuthService,
    GoogleDriveFileService,
    GoogleDriveRootService,
    GoogleDriveUploadService,
    StorageConnectionService,
    StorageProviderRegistry,
  ],
  exports: [
    GoogleDriveOAuthService,
    GoogleDriveFileService,
    GoogleDriveRootService,
    GoogleDriveUploadService,
    StorageConnectionService,
    StorageProviderRegistry,
  ],
})
export class StorageModule {}
