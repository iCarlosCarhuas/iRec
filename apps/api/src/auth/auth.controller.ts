import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  DeviceIdParamsSchema,
  EmailStartRequestSchema,
  EmailVerifyRequestSchema,
  LoginRequestSchema,
  RecoveryCodeRequestSchema,
  RecoveryEmailRequestSchema,
  RecoveryEmailVerifyRequestSchema,
  TotpConfirmRequestSchema,
  TotpRotateConfirmRequestSchema,
  TotpRotateRequestSchema,
  type EmailStartRequest,
  type EmailVerifyRequest,
  type LoginRequest,
  type RecoveryCodeRequest,
  type RecoveryEmailRequest,
  type RecoveryEmailVerifyRequest,
  type TotpConfirmRequest,
  type TotpRotateConfirmRequest,
  type TotpRotateRequest,
} from '@irec/contracts';

import { AuthService } from './auth.service.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { RateLimitService } from '../security/rate-limit.service.js';

const ACCESS_COOKIE = 'irec_access';
const REFRESH_COOKIE = 'irec_refresh';
const FLOW_COOKIE = 'irec_auth_flow';
const TRUSTED_COOKIE = 'irec_trusted';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post('email/start')
  @HttpCode(HttpStatus.ACCEPTED)
  async startEmail(
    @Req() req: Request,
    @Body(new ZodValidationPipe(EmailStartRequestSchema)) body: EmailStartRequest,
  ) {
    await this.rateLimit.consume('email-start-ip', req.ip ?? 'unknown', 10, 600);
    await this.rateLimit.consume('email-start-email', body.email, 4, 900);
    await this.auth.startEmailVerification(body.email);

    return {
      status: 'accepted' as const,
      message: 'Si el correo puede continuar, recibira instrucciones.',
    };
  }

  @Post('email/verify')
  async verifyEmail(
    @Body(new ZodValidationPipe(EmailVerifyRequestSchema)) body: EmailVerifyRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyEmail(body.token);
    this.setFlowCookie(res, result.flowToken!);
    return result.body;
  }

  @Post('totp/enroll')
  async enrollTotp(@Req() req: Request) {
    return this.auth.enrollTotp(req.cookies?.[FLOW_COOKIE]);
  }

  @Post('totp/confirm')
  async confirmTotp(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(TotpConfirmRequestSchema)) body: TotpConfirmRequest,
  ) {
    await this.rateLimit.consume('totp-confirm-ip', req.ip ?? 'unknown', 8, 300);
    const result = await this.auth.confirmTotp(
      req.cookies?.[FLOW_COOKIE],
      body.code,
      body.rememberDevice,
      req.headers['user-agent'],
    );

    this.setAuthCookies(res, result.accessToken!, result.refreshToken!);
    if (result.trustedToken) this.setTrustedCookie(res, result.trustedToken);
    res.clearCookie(FLOW_COOKIE, this.baseCookie());

    return result.body;
  }

  @Post('login')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
  ) {
    await this.rateLimit.consume('login-ip', req.ip ?? 'unknown', 12, 300);
    await this.rateLimit.consume('login-email', body.email, 8, 300);

    const result = await this.auth.login(
      body.email,
      body.code,
      body.rememberDevice,
      req.headers['user-agent'],
    );

    this.setAuthCookies(res, result.accessToken!, result.refreshToken!);
    if (result.trustedToken) this.setTrustedCookie(res, result.trustedToken);
    return result.body;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(
      req.cookies?.[ACCESS_COOKIE],
      req.cookies?.[REFRESH_COOKIE],
      req.cookies?.[TRUSTED_COOKIE],
    );

    res.clearCookie(ACCESS_COOKIE, this.baseCookie());
    res.clearCookie(REFRESH_COOKIE, this.baseCookie());
    res.clearCookie(TRUSTED_COOKIE, this.baseCookie());
    return { success: true as const };
  }

  @Get('session')
  async session(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.getSession(
      req.cookies?.[ACCESS_COOKIE],
      req.cookies?.[REFRESH_COOKIE],
      req.cookies?.[TRUSTED_COOKIE],
    );

    if (result.accessToken && result.refreshToken) this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return result.body;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
    this.setAuthCookies(res, result.accessToken!, result.refreshToken!);
    return result.body;
  }

  @Post('recovery/email')
  @HttpCode(HttpStatus.ACCEPTED)
  async recoveryEmail(
    @Req() req: Request,
    @Body(new ZodValidationPipe(RecoveryEmailRequestSchema))
    body: RecoveryEmailRequest,
  ) {
    await this.rateLimit.consume('recovery-email-ip', req.ip ?? 'unknown', 8, 900);
    await this.rateLimit.consume('recovery-email-account', body.email, 4, 1800);
    await this.auth.startRecoveryEmail(body.email);

    return {
      status: 'accepted' as const,
      message: 'Si el correo es valido, recibira instrucciones.',
    };
  }

  @Post('recovery/email/verify')
  async verifyRecoveryEmail(
    @Body(new ZodValidationPipe(RecoveryEmailVerifyRequestSchema))
    body: RecoveryEmailVerifyRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyRecoveryEmail(body.token);
    this.setFlowCookie(res, result.flowToken!);
    return result.body;
  }

  @Post('recovery/code')
  async recoveryCode(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(RecoveryCodeRequestSchema))
    body: RecoveryCodeRequest,
  ) {
    await this.rateLimit.consume('recovery-code-ip', req.ip ?? 'unknown', 8, 900);
    await this.rateLimit.consume('recovery-code-account', body.email, 6, 1800);

    const result = await this.auth.recoverWithCode(
      body.email,
      body.recoveryCode,
    );

    this.setFlowCookie(res, result.flowToken!);
    return result.body;
  }

  @Post('totp/rotate')
  async rotate(
    @Req() req: Request,
    @Body(new ZodValidationPipe(TotpRotateRequestSchema)) body: TotpRotateRequest,
  ) {
    return this.auth.startTotpRotation(
      req.cookies?.[ACCESS_COOKIE],
      body.currentCode,
    );
  }

  @Post('totp/rotate/confirm')
  async confirmRotate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(TotpRotateConfirmRequestSchema))
    body: TotpRotateConfirmRequest,
  ) {
    const result = await this.auth.confirmTotpRotation(
      req.cookies?.[ACCESS_COOKIE],
      body.code,
    );

    // Rotating TOTP revokes remembered devices.
    res.clearCookie(TRUSTED_COOKIE, this.baseCookie());
    return result;
  }

  @Get('trusted-devices')
  async trustedDevices(@Req() req: Request) {
    return this.auth.listTrustedDevices(req.cookies?.[ACCESS_COOKIE]);
  }

  @Delete('trusted-devices/:deviceId')
  async revokeTrustedDevice(
    @Req() req: Request,
    @Param(new ZodValidationPipe(DeviceIdParamsSchema)) params: { deviceId: string },
  ) {
    await this.auth.revokeTrustedDevice(
      req.cookies?.[ACCESS_COOKIE],
      params.deviceId,
    );
    return { success: true as const };
  }

  @Post('trusted-devices/revoke-all')
  async revokeAllTrustedDevices(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeAllTrustedDevices(req.cookies?.[ACCESS_COOKIE]);
    res.clearCookie(TRUSTED_COOKIE, this.baseCookie());
    return { success: true as const };
  }

private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...this.baseCookie(), maxAge: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS') * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...this.baseCookie(), maxAge: this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS') * 1000 });
}

  private setFlowCookie(res: Response, token: string): void {
    res.cookie(FLOW_COOKIE, token, {
      ...this.baseCookie(),
      maxAge: this.config.getOrThrow<number>('AUTH_FLOW_TTL_SECONDS') * 1000,
    });
  }

  private setTrustedCookie(res: Response, token: string): void {
    res.cookie(TRUSTED_COOKIE, token, {
      ...this.baseCookie(),
      maxAge:
        this.config.getOrThrow<number>('TRUSTED_DEVICE_TTL_SECONDS') * 1000,
    });
  }

  private baseCookie(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      path: '/',
    };
  }
}
