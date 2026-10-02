import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  HttpException,
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
  AuthService,
} from '../auth/auth.service.js';

import type {
  SessionPayload,
} from '../auth/session.service.js';

import { GoogleDriveOAuthService } from './google-drive-oauth.service.js';
import { GoogleDriveRootService } from './google-drive-root.service.js';

const ACCESS_COOKIE = 'irec_access';
const REFRESH_COOKIE = 'irec_refresh';
const TRUSTED_COOKIE = 'irec_trusted';

@Controller('storage/google')
export class GoogleDriveOAuthController {
  constructor(
    private readonly oauth: GoogleDriveOAuthService,
    private readonly roots: GoogleDriveRootService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('connect')
  async connect(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.requireSession(req, res);

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
    const user = await this.requireSession(req, res);

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

    const connection = await this.oauth.completeAuthorization(
      user.id,
      code,
      state,
    );

    try {
      await this.roots.prepareRoot(connection.id, user.id);
    } catch (prepareError) {
      throw this.toPrepareFailure(prepareError);
    }

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

  /**
   * The OAuth redirect flow surfaces provider preparation as a user-facing
   * retryable step (400) or a provider outage (502). Root-service messages
   * are already sanitized; only the status is remapped here.
   */
  private toPrepareFailure(error: unknown): HttpException {
    if (error instanceof HttpException) {
      const detail = this.sanitizedDetail(error);
      if (error.getStatus() >= 500) {
        return new BadGatewayException(detail);
      }
      return new BadRequestException(detail);
    }
    return new BadGatewayException(
      'Google Drive root preparation could not be completed.',
    );
  }

  private sanitizedDetail(error: HttpException): string {
    const fallback =
      'Google Drive root preparation could not be completed.';
    const response = error.getResponse();
    const detail =
      typeof response === 'string'
        ? response
        : (response as { message?: unknown }).message;
    const message = Array.isArray(detail) ? detail[0] : detail;
    return typeof message === 'string' && message.trim()
      ? message
      : fallback;
  }

  private async requireSession(
    req: Request,
    res: Response,
  ): Promise<SessionPayload> {
    const result =
      await this.auth.getSession(
        req.cookies?.[ACCESS_COOKIE],
        req.cookies?.[REFRESH_COOKIE],
        req.cookies?.[TRUSTED_COOKIE],
      );

    if (!result.body.authenticated) {
      throw new UnauthorizedException();
    }

    if (result.accessToken && result.refreshToken) {
      this.setAuthCookies(
        res,
        result.accessToken,
        result.refreshToken,
      );
    }

    return result.body.user;
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...this.baseCookie(),
      maxAge:
        this.config.getOrThrow<number>(
          'ACCESS_TOKEN_TTL_SECONDS',
        ) * 1000,
    });

    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.baseCookie(),
      maxAge:
        this.config.getOrThrow<number>(
          'REFRESH_TOKEN_TTL_SECONDS',
        ) * 1000,
    });
  }

  private baseCookie(): {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax';
    path: string;
  } {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>(
        'COOKIE_SECURE',
      ),
      sameSite: 'lax',
      path: '/',
    };
  }
}
