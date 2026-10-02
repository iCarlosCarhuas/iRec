import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  StorageConnectionIdParamsSchema,
  type StorageConnectionContract,
  type StorageConnectionIdParams,
  type StorageConnectionsResponse,
} from '@irec/contracts';
import type { Request } from 'express';

import { SessionService, type SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { GoogleDriveRootService } from './google-drive-root.service.js';
import type { StorageConnection } from './storage-connection.js';
import { StorageConnectionService } from './storage-connection.service.js';

@Controller('storage/connections')
export class StorageController {
  constructor(
    private readonly storage: StorageConnectionService,
    private readonly roots: GoogleDriveRootService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async list(@Req() req: Request): Promise<StorageConnectionsResponse> {
    const session = await this.requireSession(req);
    const connections = await this.storage.listOwned(session.id);
    return { connections: connections.map(toContract) };
  }

  @Post(':connectionId/prepare')
  @HttpCode(200)
  async prepare(
    @Req() req: Request,
    @Param(new ZodValidationPipe(StorageConnectionIdParamsSchema))
    params: StorageConnectionIdParams,
  ): Promise<StorageConnectionContract> {
    const session = await this.requireSession(req);
    return toContract(await this.roots.prepareRoot(params.connectionId, session.id));
  }

  private async requireSession(req: Request): Promise<SessionPayload> {
    const session = await this.sessions.getSession(req.cookies?.['irec_access']);
    if (!session) throw new UnauthorizedException();
    return session;
  }
}

function toContract(connection: StorageConnection): StorageConnectionContract {
  return {
    id: connection.id,
    provider: connection.provider,
    displayName: connection.displayName,
    status: connection.status,
    lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
  };
}
