import {
  BadGatewayException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { GOOGLE_DRIVE_SCOPE } from './google-drive-oauth.service.js';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Minimal config surface so the refresh flow stays testable without Nest.
 * Callers pass `(key) => config.get<string>(key)`.
 */
export type GoogleDriveConfigGetter = (key: string) => string | undefined;

/**
 * Refreshes an ephemeral Drive access token from a stored credential
 * envelope. The token lives only in memory: it is never persisted, logged,
 * or surfaced in errors. The envelope stays opaque to every caller.
 */
export async function refreshGoogleDriveAccessToken(
  getConfig: GoogleDriveConfigGetter,
  envelope: string,
): Promise<string> {
  let credential: unknown;
  try {
    credential = JSON.parse(envelope);
  } catch {
    throw driveReconnect();
  }
  if (
    !isRecord(credential) ||
    credential.version !== 1 ||
    typeof credential.refreshToken !== 'string' ||
    !credential.refreshToken.trim() ||
    typeof credential.scope !== 'string' ||
    !credential.scope.split(' ').includes(GOOGLE_DRIVE_SCOPE) ||
    credential.tokenType !== 'Bearer'
  ) {
    throw driveReconnect();
  }
  const clientId = getConfig('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = getConfig('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new ServiceUnavailableException(
      'Google Drive OAuth is not configured.',
    );
  }
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credential.refreshToken,
        grant_type: 'refresh_token',
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new BadGatewayException(
      'Google Drive no esta disponible; intentalo de nuevo.',
    );
  }
  const payload = await readDriveJson(response);
  if (
    !isRecord(payload) ||
    typeof payload.access_token !== 'string' ||
    !payload.access_token.trim() ||
    payload.token_type !== 'Bearer' ||
    typeof payload.expires_in !== 'number' ||
    payload.expires_in <= 0 ||
    (payload.scope !== undefined &&
      (typeof payload.scope !== 'string' ||
        !payload.scope.split(' ').includes(GOOGLE_DRIVE_SCOPE)))
  ) {
    if (
      isRecord(payload) &&
      payload.error === 'invalid_grant' &&
      response.status === 400
    ) {
      throw driveReconnect();
    }
    throw badDriveResponse();
  }
  return payload.access_token;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readDriveJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function driveReconnect(): UnauthorizedException {
  return new UnauthorizedException(
    'Google Drive authorization is invalid; reconnect.',
  );
}

export function badDriveResponse(): BadGatewayException {
  return new BadGatewayException(
    'Google Drive returned an invalid response.',
  );
}
