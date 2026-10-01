import { Module } from '@nestjs/common';

import { SecurityModule } from '../security/security.module.js';

import { StorageConnectionService } from './storage-connection.service.js';
import { StorageProviderRegistry } from './storage-provider.registry.js';

@Module({
  imports: [SecurityModule],
  providers: [
    StorageConnectionService,
    StorageProviderRegistry,
  ],
  exports: [
    StorageConnectionService,
    StorageProviderRegistry,
  ],
})
export class StorageModule {}
