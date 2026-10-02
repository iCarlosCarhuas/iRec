import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GOOGLE_DRIVE_SCOPE } from './google-drive-oauth.service.js';
import type { StorageConnection } from './storage-connection.js';
import { StorageConnectionService } from './storage-connection.service.js';

const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FIELDS = 'id,name,mimeType,trashed,appProperties,capabilities(canAddChildren)';
const PREPARE_TIMEOUT_MS = 30_000;
type ProviderBudget = { deadline: number; signal: AbortSignal };

const ROOT_QUERY = `trashed = false and name = 'iRec' and mimeType = '${FOLDER_MIME}' and appProperties has { key='irecRoot' and value='v1' }`;

@Injectable()
export class GoogleDriveRootService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageConnectionService,
  ) {}

  async prepareRoot(connectionId: string, ownerId: string): Promise<StorageConnection> {
    try {
      const connection = await this.storage.prepareGoogleDriveRoot(
        connectionId,
        ownerId,
        async (stored, envelope) => {
          // Begin after acquiring the row lock; await cancellation inside the
          // transaction rather than returning while detached work still runs.
          const budget: ProviderBudget = {
            deadline: performance.now() + PREPARE_TIMEOUT_MS,
            signal: AbortSignal.timeout(PREPARE_TIMEOUT_MS),
          };
          const accessToken = await this.refreshAccessToken(envelope, budget);
          if (stored.rootId) {
            const folder = await this.request(
              `${FILES_ENDPOINT}/${encodeURIComponent(stored.rootId)}?fields=${encodeURIComponent(FIELDS)}`,
              { headers: this.headers(accessToken) },
              budget,
              true,
            );
            if (folder !== null) {
              this.validateFolder(folder);
              if (folder.id !== stored.rootId) throw this.badResponse();
              // A user may rename a managed root; its marker remains authoritative.
              if (this.isManaged(folder)) return this.writableId(folder);
            }
          }
          return this.findOrCreateRoot(accessToken, budget);
        },
      );
      if (!connection) throw new NotFoundException('Storage connection not found.');
      return connection;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Includes decryption/database failures; never propagate secret-bearing causes.
      throw new ServiceUnavailableException('Google Drive root preparation could not be completed.');
    }
  }

  private async refreshAccessToken(envelope: string, budget: ProviderBudget): Promise<string> {
    let credential: unknown;
    try {
      credential = JSON.parse(envelope);
    } catch {
      throw this.reconnect();
    }
    if (
      !isRecord(credential) || credential.version !== 1 ||
      typeof credential.refreshToken !== 'string' || !credential.refreshToken.trim() ||
      typeof credential.scope !== 'string' || !credential.scope.split(' ').includes(GOOGLE_DRIVE_SCOPE) ||
      credential.tokenType !== 'Bearer'
    ) throw this.reconnect();

    const clientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Google Drive OAuth is not configured.');
    }
    const payload = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credential.refreshToken,
        grant_type: 'refresh_token',
      }),
    }, budget);
    if (
      !isRecord(payload) || typeof payload.access_token !== 'string' || !payload.access_token.trim() ||
      payload.token_type !== 'Bearer' || typeof payload.expires_in !== 'number' || payload.expires_in <= 0 ||
      (payload.scope !== undefined &&
        (typeof payload.scope !== 'string' || !payload.scope.split(' ').includes(GOOGLE_DRIVE_SCOPE)))
    ) throw this.badResponse();
    return payload.access_token;
  }

  private async findOrCreateRoot(accessToken: string, budget: ProviderBudget): Promise<string> {
    const seenPages = new Set<string>();
    let pageToken: string | undefined;
    do {
      let url: URL;
      try {
        url = new URL(FILES_ENDPOINT);
      } catch {
        throw this.badResponse();
      }
      url.searchParams.set('q', ROOT_QUERY);
      url.searchParams.set('fields', `nextPageToken,files(${FIELDS})`);
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('orderBy', 'createdTime');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const payload = await this.request(url.toString(), { headers: this.headers(accessToken) }, budget);
      if (!isRecord(payload) || !Array.isArray(payload.files)) throw this.badResponse();
      for (const folder of payload.files) {
        this.validateFolder(folder);
        if (folder.name === 'iRec' && this.isManaged(folder)) return this.writableId(folder);
      }
      if (payload.nextPageToken !== undefined &&
        (typeof payload.nextPageToken !== 'string' || !payload.nextPageToken)) throw this.badResponse();
      pageToken = payload.nextPageToken as string | undefined;
      if (pageToken) {
        // Bound provider pagination while never creating from an incomplete search.
        if (seenPages.has(pageToken) || seenPages.size >= 100) throw this.badResponse();
        seenPages.add(pageToken);
      }
    } while (pageToken);

    const folder = await this.request(`${FILES_ENDPOINT}?fields=${encodeURIComponent(FIELDS)}`, {
      method: 'POST',
      headers: { ...this.headers(accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'iRec', mimeType: FOLDER_MIME, appProperties: { irecRoot: 'v1' } }),
    }, budget);
    this.validateFolder(folder);
    if (folder.name !== 'iRec' || !this.isManaged(folder)) throw this.badResponse();
    return this.writableId(folder);
  }

  private validateFolder(folder: unknown): asserts folder is Record<string, unknown> {
    if (!isRecord(folder) || typeof folder.id !== 'string' || !folder.id ||
      typeof folder.name !== 'string' || typeof folder.mimeType !== 'string' ||
      typeof folder.trashed !== 'boolean' ||
      (folder.appProperties !== undefined && !isRecord(folder.appProperties))) throw this.badResponse();
  }

  private isManaged(folder: Record<string, unknown>): boolean {
    return folder.mimeType === FOLDER_MIME && folder.trashed === false &&
      isRecord(folder.appProperties) && folder.appProperties.irecRoot === 'v1';
  }

  private writableId(folder: Record<string, unknown>): string {
    if (!isRecord(folder.capabilities) || typeof folder.capabilities.canAddChildren !== 'boolean') {
      throw this.badResponse();
    }
    if (!folder.capabilities.canAddChildren) throw this.permissionDenied();
    return folder.id as string;
  }

  private headers(accessToken: string): Record<string, string> {
    return { authorization: `Bearer ${accessToken}`, accept: 'application/json' };
  }

  private remaining(budget: ProviderBudget): number {
    const remaining = budget.deadline - performance.now();
    if (budget.signal.aborted || remaining <= 0) throw this.unavailable();
    return Math.ceil(remaining);
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException('Google Drive is unavailable; try again later.');
  }

  private async request(
    url: string,
    init: RequestInit,
    budget: ProviderBudget,
    allowMissing = false,
  ): Promise<unknown> {
    const signal = AbortSignal.any([
      budget.signal,
      AbortSignal.timeout(Math.min(10_000, this.remaining(budget))),
    ]);
    let response: Response;
    try {
      response = await fetch(url, { ...init, redirect: 'error', signal });
      this.remaining(budget);
      signal.throwIfAborted();
    } catch {
      throw this.unavailable();
    }
    if (allowMissing && response.status === 404) return null;
    if (response.status === 401) throw this.reconnect();
    if (response.status === 403) throw this.permissionDenied();
    if (response.status === 429 || response.status >= 500) {
      throw this.unavailable();
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (signal.aborted) throw this.unavailable();
      throw this.badResponse();
    }
    this.remaining(budget);
    if (signal.aborted) throw this.unavailable();
    if (!response.ok) {
      if (url === 'https://oauth2.googleapis.com/token' && isRecord(payload) && payload.error === 'invalid_grant') {
        throw this.reconnect();
      }
      throw this.badResponse();
    }
    if (!isRecord(payload)) throw this.badResponse();
    return payload;
  }

  private reconnect(): UnauthorizedException {
    return new UnauthorizedException('Google Drive authorization is invalid; reconnect.');
  }

  private permissionDenied(): ForbiddenException {
    return new ForbiddenException('Google Drive root is not writable with the granted permissions.');
  }

  private badResponse(): BadGatewayException {
    return new BadGatewayException('Google Drive returned an invalid response.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
