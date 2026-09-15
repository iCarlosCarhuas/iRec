import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@irec/contracts';

@Controller('health')
export class HealthController {
  @Get('live')
  live(): HealthResponse {
    return this.response();
  }

  @Get('ready')
  ready(): HealthResponse {
    return this.response();
  }

  private response(): HealthResponse {
    return {
      status: 'ok',
      service: 'irec-api',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
