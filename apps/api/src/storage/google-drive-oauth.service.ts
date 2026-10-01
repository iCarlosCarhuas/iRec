import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../redis/redis.service.js';
import { CryptoService } from '../security/crypto.service.js';

export const GOOGLE_DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file';

const GOOGLE_AUTHORIZATION_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';

interface GoogleOAuthState {
  ownerId: string;
  createdAt: string;
}

@Injectable()
export class GoogleDriveOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
  ) {}

  async createAuthorizationRequest(
    ownerId: string,
  ): Promise<{
    authorizationUrl: string;
    expiresInSeconds: number;
  }> {
    const clientId = this.config.get<string>(
      'GOOGLE_OAUTH_CLIENT_ID',
    );

    const redirectUri = this.config.get<string>(
      'GOOGLE_OAUTH_REDIRECT_URI',
    );

    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException(
        'Google Drive OAuth no esta configurado.',
      );
    }

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

    const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_DRIVE_SCOPE);

    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');

    // For a user-initiated storage connection we want the consent
    // screen and explicit account selection.
    url.searchParams.set(
      'prompt',
      'consent select_account',
    );

    url.searchParams.set('state', state);

    return {
      authorizationUrl: url.toString(),
      expiresInSeconds: ttl,
    };
  }

  private stateKey(rawState: string): string {
    return [
      'irec',
      'storage',
      'google-oauth',
      this.crypto.hashOpaque(rawState),
    ].join(':');
  }
}
