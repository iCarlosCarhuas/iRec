import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service.js';
import { RateLimitService } from './rate-limit.service.js';

@Global()
@Module({
  providers: [CryptoService, RateLimitService],
  exports: [CryptoService, RateLimitService],
})
export class SecurityModule {}
