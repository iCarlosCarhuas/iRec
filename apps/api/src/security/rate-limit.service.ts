import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CryptoService } from './crypto.service.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class RateLimitService {
  constructor(
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
  ) {}

  async consume(
    scope: string,
    tracker: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    await this.redis.connect();

    const trackerHash = this.crypto.hashOpaque(tracker || 'unknown');
    const key = `irec:rate:${scope}:${trackerHash}`;
    const count = await this.redis.client.incr(key);

    if (count === 1) {
      await this.redis.client.expire(key, windowSeconds);
    }

    if (count > limit) {
      const retryAfter = Math.max(await this.redis.client.ttl(key), 1);
      throw new HttpException(
        {
          type: 'https://irec.app/problems/rate-limit',
          title: 'Too many requests',
          status: HttpStatus.TOO_MANY_REQUESTS,
          detail: 'Intenta nuevamente mas tarde.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
