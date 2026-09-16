import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HealthResponse } from '@irec/contracts';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  live(): HealthResponse {
    return this.response();
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    try {
      await Promise.all([
        this.database.ping(),
        this.redis.ping(),
      ]);
      return this.response();
    } catch {
      throw new ServiceUnavailableException({
        type: 'https://irec.app/problems/not-ready',
        title: 'Service unavailable',
        status: 503,
        detail: 'Una dependencia critica aun no esta disponible.',
      });
    }
  }

  private response(): HealthResponse {
    return {
      status: 'ok',
      service: 'irec-api',
      version: '0.2.0-dev',
      timestamp: new Date().toISOString(),
    };
  }
}
