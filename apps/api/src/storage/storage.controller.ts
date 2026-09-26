import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateStorageConnectionInput,
  StorageConnectionIdParamsSchema,
  type CreateStorageConnectionInput as CreateStorageConnectionInputType,
  type StorageConnectionIdParams,
} from '@irec/contracts';

import { SessionService, type SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { RateLimitService } from '../security/rate-limit.service.js';
import { R2VerifierService } from './r2-verifier.service.js';
import { StorageConnectionService } from './storage.service.js';

const ACCESS_COOKIE = 'irec_access';

@Controller('storage-connections')
export class StorageController {
  constructor(
    private readonly storage: StorageConnectionService,
    private readonly verifier: R2VerifierService,
    private readonly sessions: SessionService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(CreateStorageConnectionInput))
    body: CreateStorageConnectionInputType,
  ) {
    const user = await this.requireSession(req);

    await this.rateLimit.consume('storage-r2-create-user', user.id, 5, 300);
    await this.rateLimit.consume(
      'storage-r2-create-ip',
      req.ip ?? 'unknown',
      20,
      300,
    );

    const verifiedAt = await this.verifier.verify(body);
    return this.storage.persistVerified(user.id, body, verifiedAt);
  }

  @Get()
  async list(@Req() req: Request) {
    const user = await this.requireSession(req);
    return this.storage.listForOwner(user.id);
  }

  @Post(':connectionId/test')
  @HttpCode(HttpStatus.OK)
  async test(
    @Req() req: Request,
    @Param(new ZodValidationPipe(StorageConnectionIdParamsSchema))
    params: StorageConnectionIdParams,
  ) {
    const user = await this.requireSession(req);

    await this.rateLimit.consume('storage-r2-test-user', user.id, 10, 300);
    await this.rateLimit.consume(
      'storage-r2-test-ip',
      req.ip ?? 'unknown',
      30,
      300,
    );

    const credentials = await this.storage.getOwnedCredentials(
      user.id,
      params.connectionId,
    );
    const verifiedAt = await this.verifier.verify(credentials);

    return this.storage.markVerified(
      user.id,
      params.connectionId,
      verifiedAt,
    );
  }

  private async requireSession(req: Request): Promise<SessionPayload> {
    const session = await this.sessions.getSession(req.cookies?.[ACCESS_COOKIE]);
    if (!session) throw new UnauthorizedException();
    return session;
  }
}
