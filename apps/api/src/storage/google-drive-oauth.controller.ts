import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  Request,
  Response,
} from 'express';

import {
  SessionService,
  type SessionPayload,
} from '../auth/session.service.js';

import { GoogleDriveOAuthService } from './google-drive-oauth.service.js';

const ACCESS_COOKIE = 'irec_access';

@Controller('storage/google')
export class GoogleDriveOAuthController {
  constructor(
    private readonly oauth: GoogleDriveOAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Get('connect')
  async connect(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.requireSession(req);

    const result =
      await this.oauth.createAuthorizationRequest(
        user.id,
      );

    res.redirect(
      302,
      result.authorizationUrl,
    );
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
  ) {
    const user = await this.requireSession(req);

    if (error) {
      await this.oauth.cancelAuthorization(
        user.id,
        state ?? '',
      );

      if (error === 'access_denied') {
        throw new BadRequestException(
          'La autorizacion de Google Drive fue cancelada.',
        );
      }

      throw new BadRequestException(
        'Google OAuth no pudo completar la autorizacion.',
      );
    }

    if (!code || !state) {
      throw new BadRequestException(
        'OAuth callback incompleto.',
      );
    }

    return this.oauth.completeAuthorization(
      user.id,
      code,
      state,
    );
  }

  private async requireSession(
    req: Request,
  ): Promise<SessionPayload> {
    const session =
      await this.sessions.getSession(
        req.cookies?.[ACCESS_COOKIE],
      );

    if (!session) {
      throw new UnauthorizedException();
    }

    return session;
  }
}
