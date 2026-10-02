import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageConnectionIdParamsSchema,
  type StorageConnectionContract,
  type StorageConnectionIdParams,
  type StorageConnectionsResponse,
} from '@irec/contracts';
import type { Request, Response } from 'express';

import { AuthService } from '../auth/auth.service.js';
import type { SessionPayload } from '../auth/session.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { GoogleDriveRootService } from './google-drive-root.service.js';
import type { StorageConnection } from './storage-connection.js';
import { StorageConnectionService } from './storage-connection.service.js';

const ACCESS_COOKIE = 'irec_access';
const REFRESH_COOKIE = 'irec_refresh';
const TRUSTED_COOKIE = 'irec_trusted';

@Controller('storage/connections')
export class StorageController {
  constructor(
    private readonly storage: StorageConnectionService,
    private readonly roots: GoogleDriveRootService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StorageConnectionsResponse> {
    const session = await this.requireSession(req, res);
    const connections = await this.storage.listOwned(session.id);
    return { connections: connections.map(toContract) };
  }

  @Post(':connectionId/prepare')
  @HttpCode(200)
  async prepare(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param(new ZodValidationPipe(StorageConnectionIdParamsSchema))
    params: StorageConnectionIdParams,
  ): Promise<StorageConnectionContract> {
    const session = await this.requireSession(req, res);
    return toContract(await this.roots.prepareRoot(params.connectionId, session.id));
  }

  private async requireSession(req: Request, res: Response): Promise<SessionPayload> {
    const result = await this.auth.getSession(
      req.cookies?.[ACCESS_COOKIE],
      req.cookies?.[REFRESH_COOKIE],
      req.cookies?.[TRUSTED_COOKIE],
    );
    if (!result.body.authenticated) throw new UnauthorizedException();
    if (result.accessToken && result.refreshToken) {
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return result.body.user;
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...this.baseCookie(),
      maxAge: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS') * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.baseCookie(),
      maxAge: this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS') * 1000,
    });
  }

  private baseCookie(): { httpOnly: true; secure: boolean; sameSite: 'lax'; path: string } {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      path: '/',
    };
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
