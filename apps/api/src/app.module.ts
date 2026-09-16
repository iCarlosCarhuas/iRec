import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';

import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SecurityModule } from './security/security.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '../../.env.local'),
        resolve(process.cwd(), '../../.env'),
      ],
      validate: validateEnv,
      cache: true,
    }),
    DatabaseModule,
    RedisModule,
    SecurityModule,
    MailModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
