import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module.js';
import { SecurityModule } from '../security/security.module.js';

import { GoogleDriveOAuthService } from './google-drive-oauth.service.js';
import { StorageConnectionService } from './storage-connection.service.js';
import { StorageProviderRegistry } from './storage-provider.registry.js';

@Module({
  imports: [
    RedisModule,
    SecurityModule,
  ],
  providers: [
    GoogleDriveOAuthService,
    StorageConnectionService,
    StorageProviderRegistry,
  ],
  exports: [
    GoogleDriveOAuthService,
    StorageConnectionService,
    StorageProviderRegistry,
  ],
})
export class StorageModule {}
