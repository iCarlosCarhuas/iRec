import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    private readonly config: ConfigService,
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
    @Res() res: Response,
  ): Promise<void> {
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

    const settingsUrl = this.storageSettingsUrl();

    await this.oauth.completeAuthorization(
      user.id,
      code,
      state,
    );

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(302, settingsUrl);
  }

  private storageSettingsUrl(): string {
    try {
      const base = new URL(
        this.config.getOrThrow<string>('PUBLIC_WEB_URL'),
      );

      if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username || base.password
      ) {
        throw new Error('Invalid public web URL');
      }

      // Fixed path discards configured query/fragment; request input is never used.
      return new URL('/settings/storage', base).toString();
    } catch {
      throw new ServiceUnavailableException(
        'La URL publica de iRec no esta configurada correctamente.',
      );
    }
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
