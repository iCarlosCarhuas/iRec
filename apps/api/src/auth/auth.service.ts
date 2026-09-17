import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

import { DatabaseService } from '../database/database.service.js';
import {
  emailTokens,
  recoveryCodes,
  totpCredentials,
  trustedDevices,
  users,
} from '../database/schema.js';
import { CryptoService } from '../security/crypto.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  SessionService,
  type SessionPayload,
} from './session.service.js';

type AuthArtifacts<T> = {
  body: T;
  accessToken?: string;
  refreshToken?: string;
  flowToken?: string;
  trustedToken?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
  ) {}

  async startEmailVerification(emailRaw: string): Promise<void> {
    const email = this.normalizeEmail(emailRaw);
    const now = new Date();

    let [user] = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      [user] = await this.dbs.db
        .insert(users)
        .values({ email })
        .returning();
    }

    if (user.emailVerifiedAt) {
      // Anti-enumeration: same HTTP response; no token is created.
      return;
    }

    await this.dbs.db
      .update(emailTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(emailTokens.userId, user.id),
          eq(emailTokens.purpose, 'VERIFY_EMAIL'),
          isNull(emailTokens.consumedAt),
        ),
      );

    const rawToken = this.crypto.randomToken();
    const expiresAt = new Date(
      Date.now() + this.config.getOrThrow<number>('EMAIL_TOKEN_TTL_SECONDS') * 1000,
    );

    await this.dbs.db.insert(emailTokens).values({
      userId: user.id,
      purpose: 'VERIFY_EMAIL',
      tokenHash: this.crypto.hashOpaque(rawToken),
      expiresAt,
    });

    const link = new URL('/auth/verify-email', this.config.getOrThrow<string>('PUBLIC_WEB_URL'));
    link.searchParams.set('token', rawToken);

    await this.mail.sendVerificationEmail(email, link.toString());
  }

  async verifyEmail(token: string): Promise<AuthArtifacts<{
    verified: true;
    next: 'TOTP_ENROLL';
  }>> {
    const now = new Date();
    const tokenHash = this.crypto.hashOpaque(token);

    const [record] = await this.dbs.db
      .select({
        tokenId: emailTokens.id,
        userId: users.id,
        email: users.email,
      })
      .from(emailTokens)
      .innerJoin(users, eq(emailTokens.userId, users.id))
      .where(
        and(
          eq(emailTokens.tokenHash, tokenHash),
          eq(emailTokens.purpose, 'VERIFY_EMAIL'),
          isNull(emailTokens.consumedAt),
          gt(emailTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!record) {
      throw new BadRequestException({
        type: 'https://irec.app/problems/invalid-email-token',
        title: 'Invalid or expired token',
        status: 400,
        detail: 'El enlace de verificacion no es valido o ya expiro.',
      });
    }

    await this.dbs.db.transaction(async (tx) => {
      await tx
        .update(emailTokens)
        .set({ consumedAt: now })
        .where(eq(emailTokens.id, record.tokenId));

      await tx
        .update(users)
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where(eq(users.id, record.userId));
    });

    const flowToken = await this.sessions.createFlow({
      userId: record.userId,
      purpose: 'ENROLL_TOTP',
    });

    return {
      body: { verified: true, next: 'TOTP_ENROLL' },
      flowToken,
    };
  }

  async enrollTotp(flowToken: string | undefined): Promise<{
    issuer: string;
    accountName: string;
    qrDataUrl: string;
    manualEntryKey: string;
  }> {
    const flow = await this.sessions.getFlow(flowToken);
    if (!flow || !['ENROLL_TOTP', 'RECOVER_TOTP'].includes(flow.purpose)) {
      throw new UnauthorizedException('Flujo de enrolamiento invalido o expirado.');
    }

    const [user] = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.id, flow.userId))
      .limit(1);

    if (!user?.emailVerifiedAt) {
      throw new UnauthorizedException('El correo aun no esta verificado.');
    }

    const secret = generateSecret();
    const now = new Date();

    await this.dbs.db
      .update(totpCredentials)
      .set({ status: 'REVOKED', revokedAt: now })
      .where(
        and(
          eq(totpCredentials.userId, user.id),
          eq(totpCredentials.status, 'PENDING'),
        ),
      );

    await this.dbs.db.insert(totpCredentials).values({
      userId: user.id,
      status: 'PENDING',
      secretEncrypted: this.crypto.encrypt(secret),
    });

    const issuer = this.config.getOrThrow<string>('TOTP_ISSUER');
    const uri = generateURI({
      issuer,
      label: user.email,
      secret,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });
    const qrDataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });

    return {
      issuer,
      accountName: user.email,
      qrDataUrl,
      manualEntryKey: secret,
    };
  }

  async confirmTotp(
    flowToken: string | undefined,
    code: string,
    rememberDevice: boolean,
    userAgent: string | undefined,
  ): Promise<AuthArtifacts<{
    user: SessionPayload;
    recoveryCodes: string[];
  }>> {
    const flow = await this.sessions.getFlow(flowToken);
    if (!flow || !['ENROLL_TOTP', 'RECOVER_TOTP'].includes(flow.purpose)) {
      throw new UnauthorizedException('Flujo de enrolamiento invalido o expirado.');
    }

    const [user] = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.id, flow.userId))
      .limit(1);

    if (!user?.emailVerifiedAt) {
      throw new UnauthorizedException();
    }

    const [pending] = await this.dbs.db
      .select()
      .from(totpCredentials)
      .where(
        and(
          eq(totpCredentials.userId, user.id),
          eq(totpCredentials.status, 'PENDING'),
        ),
      )
      .orderBy(desc(totpCredentials.createdAt))
      .limit(1);

    if (!pending) {
      throw new BadRequestException('No existe un TOTP pendiente.');
    }

    const secret = this.crypto.decrypt(pending.secretEncrypted);
    const result = await verify({
      secret,
      token: code,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      epochTolerance: 30,
    });

    if (!result.valid || !('timeStep' in result)) {
      throw new UnauthorizedException('Codigo TOTP invalido.');
    }

    const rawRecoveryCodes = this.crypto.generateRecoveryCodes(10);
    const now = new Date();

    await this.dbs.db.transaction(async (tx) => {
      await tx
        .update(totpCredentials)
        .set({ status: 'REVOKED', revokedAt: now })
        .where(
          and(
            eq(totpCredentials.userId, user.id),
            eq(totpCredentials.status, 'ACTIVE'),
          ),
        );

      await tx
        .update(totpCredentials)
        .set({
          status: 'ACTIVE',
          activatedAt: now,
          lastTimeStep: result.timeStep,
        })
        .where(eq(totpCredentials.id, pending.id));

      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, user.id));

      await tx.insert(recoveryCodes).values(
        await Promise.all(rawRecoveryCodes.map(async (recoveryCode) => ({
          userId: user.id,
          codeHash: await this.crypto.hashRecoveryCode(recoveryCode),
        }))),
      );

      if (flow.purpose === 'RECOVER_TOTP') {
        await tx
          .update(trustedDevices)
          .set({ revokedAt: now })
          .where(
            and(
              eq(trustedDevices.userId, user.id),
              isNull(trustedDevices.revokedAt),
            ),
          );
      }
    });

    await this.sessions.deleteFlow(flowToken);

    const sessionUser = this.sessionUser(user);
    const tokens = await this.sessions.createSession(sessionUser);
    const trustedToken = rememberDevice
      ? await this.createTrustedDevice(user.id, userAgent)
      : undefined;

    return {
      body: {
        user: sessionUser,
        recoveryCodes: rawRecoveryCodes,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      trustedToken,
    };
  }

  async login(
    emailRaw: string,
    code: string,
    rememberDevice: boolean,
    userAgent: string | undefined,
  ): Promise<AuthArtifacts<{ authenticated: true; user: SessionPayload }>> {
    const email = this.normalizeEmail(emailRaw);

    const [user] = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user?.emailVerifiedAt) {
      throw this.invalidLogin();
    }

    const [credential] = await this.dbs.db
      .select()
      .from(totpCredentials)
      .where(
        and(
          eq(totpCredentials.userId, user.id),
          eq(totpCredentials.status, 'ACTIVE'),
        ),
      )
      .orderBy(desc(totpCredentials.activatedAt))
      .limit(1);

    if (!credential) {
      throw this.invalidLogin();
    }

    const secret = this.crypto.decrypt(credential.secretEncrypted);
    const result = await verify({
      secret,
      token: code,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      epochTolerance: 30,
      afterTimeStep: credential.lastTimeStep ?? undefined,
    });

    if (!result.valid || !('timeStep' in result)) {
      throw this.invalidLogin();
    }

    await this.dbs.db
      .update(totpCredentials)
      .set({ lastTimeStep: result.timeStep })
      .where(eq(totpCredentials.id, credential.id));

    const sessionUser = this.sessionUser(user);
    const tokens = await this.sessions.createSession(sessionUser);
    const trustedToken = rememberDevice
      ? await this.createTrustedDevice(user.id, userAgent)
      : undefined;

    return {
      body: { authenticated: true, user: sessionUser },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      trustedToken,
    };
  }

async getSession(accessToken: string | undefined, refreshToken: string | undefined, trustedToken: string | undefined): Promise<AuthArtifacts<{ authenticated: false } | { authenticated: true; user: SessionPayload }>> {
  const session = await this.sessions.getSession(accessToken);
  if (session) return { body: { authenticated: true, user: session } };
  const rotated = await this.sessions.rotateRefresh(refreshToken);
  if (rotated) return { body: { authenticated: true, user: rotated.payload }, accessToken: rotated.tokens.accessToken, refreshToken: rotated.tokens.refreshToken };
  if (!trustedToken) return { body: { authenticated: false } };
  const tokenHash = this.crypto.hashOpaque(trustedToken); const now = new Date();
  const [device] = await this.dbs.db.select({ deviceId: trustedDevices.id, userId: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(trustedDevices).innerJoin(users, eq(trustedDevices.userId, users.id))
    .where(and(eq(trustedDevices.tokenHash, tokenHash), isNull(trustedDevices.revokedAt), gt(trustedDevices.expiresAt, now))).limit(1);
  if (!device?.emailVerifiedAt) return { body: { authenticated: false } };
  await this.dbs.db.update(trustedDevices).set({ lastUsedAt: now }).where(eq(trustedDevices.id, device.deviceId));
  const user: SessionPayload = { id: device.userId, email: device.email, emailVerifiedAt: device.emailVerifiedAt.toISOString() };
  const tokens = await this.sessions.createSession(user);
  return { body: { authenticated: true, user }, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

async refresh(refreshToken: string | undefined): Promise<AuthArtifacts<{ authenticated: true; user: SessionPayload }>> {
  const rotated = await this.sessions.rotateRefresh(refreshToken);
  if (!rotated) throw new UnauthorizedException('Refresh token invalido o expirado.');
  return { body: { authenticated: true, user: rotated.payload }, accessToken: rotated.tokens.accessToken, refreshToken: rotated.tokens.refreshToken };
}

async logout(accessToken: string | undefined, refreshToken: string | undefined, trustedToken: string | undefined): Promise<void> {
  await this.sessions.deleteSession(accessToken, refreshToken);
  if (trustedToken) await this.dbs.db.update(trustedDevices).set({ revokedAt: new Date() }).where(eq(trustedDevices.tokenHash, this.crypto.hashOpaque(trustedToken)));
}

  async startRecoveryEmail(emailRaw: string): Promise<void> {
    const email = this.normalizeEmail(emailRaw);
    const [user] = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Anti-enumeration.
    if (!user?.emailVerifiedAt) return;

    const now = new Date();
    await this.dbs.db
      .update(emailTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(emailTokens.userId, user.id),
          eq(emailTokens.purpose, 'RECOVER_TOTP'),
          isNull(emailTokens.consumedAt),
        ),
      );

    const rawToken = this.crypto.randomToken();
    const expiresAt = new Date(
      Date.now() + this.config.getOrThrow<number>('EMAIL_TOKEN_TTL_SECONDS') * 1000,
    );

    await this.dbs.db.insert(emailTokens).values({
      userId: user.id,
      purpose: 'RECOVER_TOTP',
      tokenHash: this.crypto.hashOpaque(rawToken),
      expiresAt,
    });

    const link = new URL('/auth/recover', this.config.getOrThrow<string>('PUBLIC_WEB_URL'));
    link.searchParams.set('token', rawToken);

    await this.mail.sendRecoveryEmail(email, link.toString());
  }

  async verifyRecoveryEmail(token: string): Promise<AuthArtifacts<{
    recovered: true;
    next: 'TOTP_ENROLL';
  }>> {
    const tokenHash = this.crypto.hashOpaque(token);
    const now = new Date();

    const [record] = await this.dbs.db
      .select()
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.tokenHash, tokenHash),
          eq(emailTokens.purpose, 'RECOVER_TOTP'),
          isNull(emailTokens.consumedAt),
          gt(emailTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!record) {
      throw new BadRequestException('Token de recuperacion invalido o expirado.');
    }

    await this.dbs.db
      .update(emailTokens)
      .set({ consumedAt: now })
      .where(eq(emailTokens.id, record.id));

    const flowToken = await this.sessions.createFlow({
      userId: record.userId,
      purpose: 'RECOVER_TOTP',
    });

    return {
      body: { recovered: true, next: 'TOTP_ENROLL' },
      flowToken,
    };
  }

  async recoverWithCode(
    emailRaw: string,
    rawRecoveryCode: string,
  ): Promise<AuthArtifacts<{
    recovered: true;
    next: 'TOTP_ENROLL';
  }>> {
    const email = this.normalizeEmail(emailRaw);
    const [user] = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user?.emailVerifiedAt) {
      throw new UnauthorizedException('Credenciales de recuperacion invalidas.');
    }

    const candidates = await this.dbs.db.select().from(recoveryCodes).where(and(eq(recoveryCodes.userId, user.id), isNull(recoveryCodes.usedAt)));
    let record: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await this.crypto.verifyRecoveryCode(rawRecoveryCode, candidate.codeHash)) { record = candidate; break; }
    }
    if (!record) throw new UnauthorizedException('Credenciales de recuperacion invalidas.');

    await this.dbs.db
      .update(recoveryCodes)
      .set({ usedAt: new Date() })
      .where(eq(recoveryCodes.id, record.id));

    const flowToken = await this.sessions.createFlow({
      userId: user.id,
      purpose: 'RECOVER_TOTP',
    });

    return {
      body: { recovered: true, next: 'TOTP_ENROLL' },
      flowToken,
    };
  }

  async startTotpRotation(
    sessionToken: string | undefined,
    currentCode: string,
  ): Promise<{
    issuer: string;
    accountName: string;
    qrDataUrl: string;
    manualEntryKey: string;
  }> {
    const user = await this.requireSession(sessionToken);

    const [credential] = await this.dbs.db
      .select()
      .from(totpCredentials)
      .where(
        and(
          eq(totpCredentials.userId, user.id),
          eq(totpCredentials.status, 'ACTIVE'),
        ),
      )
      .orderBy(desc(totpCredentials.activatedAt))
      .limit(1);

    if (!credential) throw new UnauthorizedException();

    const result = await verify({
      secret: this.crypto.decrypt(credential.secretEncrypted),
      token: currentCode,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      epochTolerance: 30,
      afterTimeStep: credential.lastTimeStep ?? undefined,
    });

    if (!result.valid || !('timeStep' in result)) {
      throw new UnauthorizedException('Codigo TOTP invalido.');
    }

    await this.dbs.db
      .update(totpCredentials)
      .set({ lastTimeStep: result.timeStep })
      .where(eq(totpCredentials.id, credential.id));

    const secret = generateSecret();
    const now = new Date();

    await this.dbs.db
      .update(totpCredentials)
      .set({ status: 'REVOKED', revokedAt: now })
      .where(
        and(
          eq(totpCredentials.userId, user.id),
          eq(totpCredentials.status, 'PENDING'),
        ),
      );

    await this.dbs.db.insert(totpCredentials).values({
      userId: user.id,
      status: 'PENDING',
      secretEncrypted: this.crypto.encrypt(secret),
    });

    const issuer = this.config.getOrThrow<string>('TOTP_ISSUER');
    const uri = generateURI({
      issuer,
      label: user.email,
      secret,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
    });

    return {
      issuer,
      accountName: user.email,
      qrDataUrl: await QRCode.toDataURL(uri, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
      }),
      manualEntryKey: secret,
    };
  }

  async confirmTotpRotation(
    sessionToken: string | undefined,
    code: string,
  ): Promise<{ user: SessionPayload; recoveryCodes: string[] }> {
    const user = await this.requireSession(sessionToken);

    const [pending] = await this.dbs.db
      .select()
      .from(totpCredentials)
      .where(
        and(
          eq(totpCredentials.userId, user.id),
          eq(totpCredentials.status, 'PENDING'),
        ),
      )
      .orderBy(desc(totpCredentials.createdAt))
      .limit(1);

    if (!pending) throw new BadRequestException('No existe rotacion pendiente.');

    const result = await verify({
      secret: this.crypto.decrypt(pending.secretEncrypted),
      token: code,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      epochTolerance: 30,
    });

    if (!result.valid || !('timeStep' in result)) {
      throw new UnauthorizedException('Codigo TOTP invalido.');
    }

    const codes = this.crypto.generateRecoveryCodes(10);
    const now = new Date();

    await this.dbs.db.transaction(async (tx) => {
      await tx
        .update(totpCredentials)
        .set({ status: 'REVOKED', revokedAt: now })
        .where(
          and(
            eq(totpCredentials.userId, user.id),
            eq(totpCredentials.status, 'ACTIVE'),
          ),
        );

      await tx
        .update(totpCredentials)
        .set({
          status: 'ACTIVE',
          activatedAt: now,
          lastTimeStep: result.timeStep,
        })
        .where(eq(totpCredentials.id, pending.id));

      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, user.id));
      await tx.insert(recoveryCodes).values(
        await Promise.all(codes.map(async (recoveryCode) => ({
          userId: user.id,
          codeHash: await this.crypto.hashRecoveryCode(recoveryCode),
        }))),
      );

      // Rotation is security-sensitive: revoke all remembered devices.
      await tx
        .update(trustedDevices)
        .set({ revokedAt: now })
        .where(
          and(
            eq(trustedDevices.userId, user.id),
            isNull(trustedDevices.revokedAt),
          ),
        );
    });

    return { user, recoveryCodes: codes };
  }

  async listTrustedDevices(sessionToken: string | undefined) {
    const user = await this.requireSession(sessionToken);
    const now = new Date();

    const devices = await this.dbs.db
      .select({
        id: trustedDevices.id,
        userAgent: trustedDevices.userAgent,
        createdAt: trustedDevices.createdAt,
        lastUsedAt: trustedDevices.lastUsedAt,
        expiresAt: trustedDevices.expiresAt,
      })
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, user.id),
          isNull(trustedDevices.revokedAt),
          gt(trustedDevices.expiresAt, now),
        ),
      )
      .orderBy(desc(trustedDevices.createdAt));

    return {
      devices: devices.map((device) => ({
        ...device,
        createdAt: device.createdAt.toISOString(),
        lastUsedAt: device.lastUsedAt?.toISOString() ?? null,
        expiresAt: device.expiresAt.toISOString(),
      })),
    };
  }

  async revokeTrustedDevice(
    sessionToken: string | undefined,
    deviceId: string,
  ): Promise<void> {
    const user = await this.requireSession(sessionToken);

    await this.dbs.db
      .update(trustedDevices)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(trustedDevices.id, deviceId),
          eq(trustedDevices.userId, user.id),
        ),
      );
  }

  async revokeAllTrustedDevices(sessionToken: string | undefined): Promise<void> {
    const user = await this.requireSession(sessionToken);

    await this.dbs.db
      .update(trustedDevices)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(trustedDevices.userId, user.id),
          isNull(trustedDevices.revokedAt),
        ),
      );
  }

  private async createTrustedDevice(
    userId: string,
    userAgent: string | undefined,
  ): Promise<string> {
    const token = this.crypto.randomToken();
    const expiresAt = new Date(
      Date.now() +
        this.config.getOrThrow<number>('TRUSTED_DEVICE_TTL_SECONDS') * 1000,
    );

    await this.dbs.db.insert(trustedDevices).values({
      userId,
      tokenHash: this.crypto.hashOpaque(token),
      userAgent: userAgent?.slice(0, 500),
      expiresAt,
    });

    return token;
  }

  private async requireSession(
    sessionToken: string | undefined,
  ): Promise<SessionPayload> {
    const session = await this.sessions.getSession(sessionToken);
    if (!session) throw new UnauthorizedException();
    return session;
  }

  private sessionUser(user: {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
  }): SessionPayload {
    if (!user.emailVerifiedAt) throw new ConflictException('Email no verificado');

    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt.toISOString(),
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private invalidLogin(): UnauthorizedException {
    return new UnauthorizedException({
      type: 'https://irec.app/problems/invalid-login',
      title: 'Invalid credentials',
      status: 401,
      detail: 'Correo o codigo TOTP invalido.',
    });
  }
}
