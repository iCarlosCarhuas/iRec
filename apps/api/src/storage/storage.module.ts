import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { R2VerifierService } from './r2-verifier.service.js';
import { StorageController } from './storage.controller.js';
import { StorageConnectionService } from './storage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StorageController],
  providers: [StorageConnectionService, R2VerifierService],
  exports: [StorageConnectionService],
})
export class StorageModule {}
