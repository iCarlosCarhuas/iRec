import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../redis/redis.service.js';
import { CryptoService } from '../security/crypto.service.js';

import type { StorageConnection } from './storage-connection.js';
import { StorageConnectionService } from './storage-connection.service.js';

export const GOOGLE_DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file';

const GOOGLE_AUTHORIZATION_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';

const GOOGLE_TOKEN_ENDPOINT =
  'https://oauth2.googleapis.com/token';

const GOOGLE_DRIVE_ABOUT_ENDPOINT =
  'https://www.googleapis.com/drive/v3/about';

interface GoogleOAuthState {
  ownerId: string;
  createdAt: string;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  tokenType: string | null;
}

interface GoogleDriveUser {
  permissionId: string;
  displayName: string | null;
  emailAddress: string | null;
}

@Injectable()
export class GoogleDriveOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
    private readonly storage: StorageConnectionService,
  ) {}

  async createAuthorizationRequest(
    ownerId: string,
  ): Promise<{
    authorizationUrl: string;
    expiresInSeconds: number;
  }> {
    const oauth = this.getOAuthConfig();

    const ttl =
      this.config.get<number>(
        'GOOGLE_OAUTH_STATE_TTL_SECONDS',
      ) ?? 600;

    const state = this.crypto.randomToken(32);

    const payload: GoogleOAuthState = {
      ownerId,
      createdAt: new Date().toISOString(),
    };

    await this.redis.connect();

    await this.redis.client.set(
      this.stateKey(state),
      JSON.stringify(payload),
      'EX',
      ttl,
    );

    const url = new URL(
      GOOGLE_AUTHORIZATION_ENDPOINT,
    );

    url.searchParams.set(
      'client_id',
      oauth.clientId,
    );

    url.searchParams.set(
      'redirect_uri',
      oauth.redirectUri,
    );

    url.searchParams.set(
      'response_type',
      'code',
    );

    url.searchParams.set(
      'scope',
      GOOGLE_DRIVE_SCOPE,
    );

    url.searchParams.set(
      'access_type',
      'offline',
    );

    url.searchParams.set(
      'include_granted_scopes',
      'true',
    );

    url.searchParams.set(
      'prompt',
      'consent select_account',
    );

    url.searchParams.set(
      'state',
      state,
    );

    return {
      authorizationUrl: url.toString(),
      expiresInSeconds: ttl,
    };
  }

  async completeAuthorization(
    ownerId: string,
    code: string,
    rawState: string,
  ): Promise<StorageConnection> {
    const oauth = this.getOAuthConfig();

    const state = await this.consumeState(
      rawState,
    );

    if (!state || state.ownerId !== ownerId) {
      throw new BadRequestException(
        'OAuth state invalido o expirado.',
      );
    }

    const token = await this.exchangeCode(
      oauth,
      code,
    );

    if (!token.refreshToken) {
      throw new BadRequestException(
        'Google no entrego un refresh token para esta conexion.',
      );
    }

    const driveUser = await this.getDriveUser(
      token.accessToken,
    );

    const credentialEnvelope = JSON.stringify({
      version: 1,
      refreshToken: token.refreshToken,
      scope:
        token.scope ??
        GOOGLE_DRIVE_SCOPE,
      tokenType:
        token.tokenType ??
        'Bearer',
    });

    return this.storage.upsert(
      ownerId,
      {
        provider: 'google_drive',
        providerAccountId:
          driveUser.permissionId,
        displayName:
          driveUser.displayName ??
          driveUser.emailAddress,
        rootId: null,
        credentialEnvelope,
      },
    );
  }

  private async consumeState(
    rawState: string,
  ): Promise<GoogleOAuthState | null> {
    if (!rawState) return null;

    await this.redis.connect();

    const value = await this.redis.client.call(
      'GETDEL',
      this.stateKey(rawState),
    );

    if (typeof value !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(
        value,
      ) as Partial<GoogleOAuthState>;

      if (
        typeof parsed.ownerId !== 'string' ||
        typeof parsed.createdAt !== 'string'
      ) {
        return null;
      }

      return {
        ownerId: parsed.ownerId,
        createdAt: parsed.createdAt,
      };
    } catch {
      return null;
    }
  }

  private async exchangeCode(
    oauth: GoogleOAuthConfig,
    code: string,
  ): Promise<GoogleTokenResponse> {
    if (!code) {
      throw new BadRequestException(
        'Authorization code requerido.',
      );
    }

    const body = new URLSearchParams({
      code,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      redirect_uri: oauth.redirectUri,
      grant_type: 'authorization_code',
    });

    let response: Response;

    try {
      response = await fetch(
        GOOGLE_TOKEN_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body,
        },
      );
    } catch {
      throw new BadGatewayException(
        'No se pudo contactar a Google OAuth.',
      );
    }

    const payload =
      await this.readJson(response);

    if (
      !response.ok ||
      !isRecord(payload) ||
      typeof payload.access_token !== 'string'
    ) {
      throw new BadGatewayException(
        'Google OAuth no pudo completar el intercambio del codigo.',
      );
    }

    return {
      accessToken: payload.access_token,
      refreshToken:
        typeof payload.refresh_token === 'string'
          ? payload.refresh_token
          : null,
      scope:
        typeof payload.scope === 'string'
          ? payload.scope
          : null,
      tokenType:
        typeof payload.token_type === 'string'
          ? payload.token_type
          : null,
    };
  }

  private async getDriveUser(
    accessToken: string,
  ): Promise<GoogleDriveUser> {
    const url = new URL(
      GOOGLE_DRIVE_ABOUT_ENDPOINT,
    );

    url.searchParams.set(
      'fields',
      'user(permissionId,displayName,emailAddress)',
    );

    let response: Response;

    try {
      response = await fetch(
        url.toString(),
        {
          headers: {
            authorization:
              `Bearer ${accessToken}`,
            accept: 'application/json',
          },
        },
      );
    } catch {
      throw new BadGatewayException(
        'No se pudo consultar Google Drive.',
      );
    }

    const payload =
      await this.readJson(response);

    if (
      !response.ok ||
      !isRecord(payload) ||
      !isRecord(payload.user) ||
      typeof payload.user.permissionId !==
        'string'
    ) {
      throw new BadGatewayException(
        'Google Drive no devolvio una identidad valida.',
      );
    }

    return {
      permissionId:
        payload.user.permissionId,

      displayName:
        typeof payload.user.displayName ===
        'string'
          ? payload.user.displayName
          : null,

      emailAddress:
        typeof payload.user.emailAddress ===
        'string'
          ? payload.user.emailAddress
          : null,
    };
  }

  private async readJson(
    response: Response,
  ): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private getOAuthConfig(): GoogleOAuthConfig {
    const clientId =
      this.config.get<string>(
        'GOOGLE_OAUTH_CLIENT_ID',
      );

    const clientSecret =
      this.config.get<string>(
        'GOOGLE_OAUTH_CLIENT_SECRET',
      );

    const redirectUri =
      this.config.get<string>(
        'GOOGLE_OAUTH_REDIRECT_URI',
      );

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      throw new ServiceUnavailableException(
        'Google Drive OAuth no esta configurado.',
      );
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
    };
  }

  private stateKey(
    rawState: string,
  ): string {
    return [
      'irec',
      'storage',
      'google-oauth',
      this.crypto.hashOpaque(rawState),
    ].join(':');
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}
