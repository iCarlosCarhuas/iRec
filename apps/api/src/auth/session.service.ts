import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';
import { CryptoService } from '../security/crypto.service.js';
import { RedisService } from '../redis/redis.service.js';

export type SessionPayload = { id: string; email: string; emailVerifiedAt: string };
export type AuthFlowPurpose = 'ENROLL_TOTP' | 'RECOVER_TOTP';
type AuthFlow = { userId: string; purpose: AuthFlowPurpose };
type RefreshState = { payload: SessionPayload; familyId: string; expiresAt: number };
export type TokenPair = { accessToken: string; refreshToken: string };

@Injectable()
export class SessionService {
  private readonly issuer: string;
  private readonly audience: string;
  private privateKey?: ReturnType<typeof importPKCS8>;
  private publicKey?: ReturnType<typeof importSPKI>;
  constructor(private readonly config: ConfigService, private readonly crypto: CryptoService, private readonly redis: RedisService) {
    this.issuer = config.getOrThrow<string>('JWT_ISSUER');
    this.audience = config.getOrThrow<string>('JWT_AUDIENCE');
  }
  async createSession(payload: SessionPayload): Promise<TokenPair> { return this.issuePair(payload, this.crypto.randomToken(24)); }
  async getSession(accessToken: string | undefined): Promise<SessionPayload | null> {
    if (!accessToken) return null;
    try {
      const { payload } = await jwtVerify(accessToken, await this.getPublicKey(), { issuer: this.issuer, audience: this.audience, algorithms: ['RS256'] });
      if (!payload.jti || await this.isAccessRevoked(payload.jti)) return null;
      const id = payload.sub; const email = payload['email']; const emailVerifiedAt = payload['emailVerifiedAt'];
      if (typeof id !== 'string' || typeof email !== 'string' || typeof emailVerifiedAt !== 'string') return null;
      return { id, email, emailVerifiedAt };
    } catch { return null; }
  }
  async rotateRefresh(refreshToken: string | undefined): Promise<{ payload: SessionPayload; tokens: TokenPair } | null> {
    if (!refreshToken) return null;
    await this.redis.connect();
    const hash = this.crypto.hashOpaque(refreshToken);
    const usedFamily = await this.redis.client.get(this.usedRefreshKey(hash));
    if (usedFamily) { await this.revokeFamily(usedFamily); throw new UnauthorizedException('Refresh token reutilizado; familia revocada.'); }
    const raw = await this.redis.client.get(this.refreshKey(hash));
    if (!raw) return null;
    const state = JSON.parse(raw) as RefreshState;
    const remaining = Math.max(1, Math.floor((state.expiresAt - Date.now()) / 1000));
    await this.redis.client.del(this.refreshKey(hash));
    await this.redis.client.srem(this.familyKey(state.familyId), hash);
    await this.redis.client.set(this.usedRefreshKey(hash), state.familyId, 'EX', remaining);
    const tokens = await this.issuePair(state.payload, state.familyId);
    return { payload: state.payload, tokens };
  }
  async deleteSession(accessToken: string | undefined, refreshToken: string | undefined): Promise<void> {
    if (accessToken) await this.revokeAccess(accessToken);
    if (!refreshToken) return;
    await this.redis.connect();
    const hash = this.crypto.hashOpaque(refreshToken);
    const raw = await this.redis.client.get(this.refreshKey(hash));
    if (raw) await this.revokeFamily((JSON.parse(raw) as RefreshState).familyId);
  }
  async createFlow(flow: AuthFlow): Promise<string> {
    await this.redis.connect();
    const token = this.crypto.randomToken();
    await this.redis.client.set(this.flowKey(token), JSON.stringify(flow), 'EX', this.config.getOrThrow<number>('AUTH_FLOW_TTL_SECONDS'));
    return token;
  }
  async getFlow(token: string | undefined): Promise<AuthFlow | null> {
    if (!token) return null; await this.redis.connect();
    const raw = await this.redis.client.get(this.flowKey(token)); if (!raw) return null;
    try { return JSON.parse(raw) as AuthFlow; } catch { return null; }
  }
  async deleteFlow(token: string | undefined): Promise<void> { if (token) { await this.redis.connect(); await this.redis.client.del(this.flowKey(token)); } }
  private async issuePair(payload: SessionPayload, familyId: string): Promise<TokenPair> {
    await this.redis.connect();
    const accessTtl = this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS');
    const refreshTtl = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS');
    const accessToken = await new SignJWT({ email: payload.email, emailVerifiedAt: payload.emailVerifiedAt })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(this.issuer).setAudience(this.audience)
      .setSubject(payload.id).setJti(this.crypto.randomToken(18)).setIssuedAt().setExpirationTime(`${accessTtl}s`)
      .sign(await this.getPrivateKey());
    const refreshToken = this.crypto.randomToken(48);
    const hash = this.crypto.hashOpaque(refreshToken);
    const state: RefreshState = { payload, familyId, expiresAt: Date.now() + refreshTtl * 1000 };
    await this.redis.client.set(this.refreshKey(hash), JSON.stringify(state), 'EX', refreshTtl);
    await this.redis.client.sadd(this.familyKey(familyId), hash);
    await this.redis.client.expire(this.familyKey(familyId), refreshTtl);
    return { accessToken, refreshToken };
  }
  private async revokeAccess(token: string): Promise<void> {
    try {
      const { payload } = await jwtVerify(token, await this.getPublicKey(), { issuer: this.issuer, audience: this.audience, algorithms: ['RS256'] });
      if (!payload.jti || !payload.exp) return;
      await this.redis.connect();
      await this.redis.client.set(this.revokedAccessKey(payload.jti), '1', 'EX', Math.max(1, payload.exp - Math.floor(Date.now() / 1000)));
    } catch {}
  }
  private async revokeFamily(familyId: string): Promise<void> {
    await this.redis.connect(); const key = this.familyKey(familyId); const hashes = await this.redis.client.smembers(key);
    if (hashes.length) await this.redis.client.del(...hashes.map((h: string) => this.refreshKey(h)));
    await this.redis.client.del(key);
  }
  private async isAccessRevoked(jti: string): Promise<boolean> { await this.redis.connect(); return (await this.redis.client.exists(this.revokedAccessKey(jti))) === 1; }
  private getPrivateKey(): ReturnType<typeof importPKCS8> { this.privateKey ??= importPKCS8(Buffer.from(this.config.getOrThrow<string>('JWT_PRIVATE_KEY_B64'), 'base64').toString('utf8'), 'RS256'); return this.privateKey; }
  private getPublicKey(): ReturnType<typeof importSPKI> { this.publicKey ??= importSPKI(Buffer.from(this.config.getOrThrow<string>('JWT_PUBLIC_KEY_B64'), 'base64').toString('utf8'), 'RS256'); return this.publicKey; }
  private refreshKey(hash: string) { return `irec:refresh:${hash}`; }
  private usedRefreshKey(hash: string) { return `irec:refresh-used:${hash}`; }
  private familyKey(id: string) { return `irec:refresh-family:${id}`; }
  private revokedAccessKey(jti: string) { return `irec:access-revoked:${jti}`; }
  private flowKey(token: string) { return `irec:auth-flow:${this.crypto.hashOpaque(token)}`; }
}
