import { Module } from '@nestjs/common';

import { StorageConnectionService } from './storage.service.js';

@Module({
  providers: [StorageConnectionService],
  exports: [StorageConnectionService],
})
export class StorageModule {}
