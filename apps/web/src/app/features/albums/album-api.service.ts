import { HttpClient, type HttpEvent } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  AlbumAssetContract,
  AlbumAssetsResponse,
  AlbumContract,
  AlbumListResponse,
  AlbumMemberViewContract,
  AlbumMembersResponse,
  AlbumProposalViewContract,
  AlbumProposalsResponse,
  CreateAlbumInput,
  CreateAlbumProposalInput,
  InviteAlbumMemberInput,
  SuccessResponse,
  UpdateAlbumInput,
} from '@irec/contracts';
import type { Observable } from 'rxjs';

export const SUPPORTED_UPLOAD_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

export const UPLOAD_ACCEPT =
  '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.webm';

export const UPLOAD_FORMATS_LABEL =
  'jpg, jpeg, png, webp, gif, heic, heif, mp4, mov o webm';

export const UPLOAD_TOO_LARGE_MESSAGE =
  'Archivo muy grande para el servidor (limite 100 MB). Prueba con uno menor o comprimido.';

/** Normalizes client mime aliases (`image/jpg` → `image/jpeg`). */
export function normalizeUploadMimeType(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const lowered = raw.trim().toLowerCase();
  const canonical = lowered === 'image/jpg' ? 'image/jpeg' : lowered;
  return (SUPPORTED_UPLOAD_MIMES as readonly string[]).includes(canonical)
    ? canonical
    : null;
}

/** Type guard for the upload allowlist (alias-aware). */
export function isSupportedUploadMime(value: unknown): value is string {
  return normalizeUploadMimeType(value) !== null;
}

/** True for playable video assets (mp4/mov/webm) rendered in `<video>`. */
export function isVideoAssetMime(mimeType: string): boolean {
  return (
    mimeType === 'video/mp4' ||
    mimeType === 'video/quicktime' ||
    mimeType === 'video/webm'
  );
}

/** True for heic/heif: stored + listed, but preview-limited in browsers. */
export function isPreviewLimitedImageMime(mimeType: string): boolean {
  return mimeType === 'image/heic' || mimeType === 'image/heif';
}

@Injectable({ providedIn: 'root' })
export class AlbumApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/albums';

  list(): Observable<AlbumListResponse> {
    return this.http.get<AlbumListResponse>(this.base, {
      withCredentials: true,
    });
  }

  create(input: CreateAlbumInput): Observable<AlbumContract> {
    return this.http.post<AlbumContract>(this.base, input, {
      withCredentials: true,
    });
  }

  get(albumId: string): Observable<AlbumContract> {
    return this.http.get<AlbumContract>(`${this.base}/${encodeURIComponent(albumId)}`, {
      withCredentials: true,
    });
  }

  update(albumId: string, input: UpdateAlbumInput): Observable<AlbumContract> {
    return this.http.patch<AlbumContract>(
      `${this.base}/${encodeURIComponent(albumId)}`,
      input,
      { withCredentials: true },
    );
  }

  members(albumId: string): Observable<AlbumMembersResponse> {
    return this.http.get<AlbumMembersResponse>(
      `${this.base}/${encodeURIComponent(albumId)}/members`,
      { withCredentials: true },
    );
  }

  invite(
    albumId: string,
    input: InviteAlbumMemberInput,
  ): Observable<AlbumMemberViewContract> {
    return this.http.post<AlbumMemberViewContract>(
      `${this.base}/${encodeURIComponent(albumId)}/members/invite`,
      input,
      { withCredentials: true },
    );
  }

  accept(albumId: string): Observable<AlbumMemberViewContract> {
    return this.http.post<AlbumMemberViewContract>(
      `${this.base}/${encodeURIComponent(albumId)}/members/accept`,
      {},
      { withCredentials: true },
    );
  }

  removeMember(albumId: string, userId: string): Observable<SuccessResponse> {
    return this.http.delete<SuccessResponse>(
      `${this.base}/${encodeURIComponent(albumId)}/members/${encodeURIComponent(userId)}`,
      { withCredentials: true },
    );
  }

  createProposal(
    albumId: string,
    input: CreateAlbumProposalInput,
  ): Observable<AlbumProposalViewContract> {
    return this.http.post<AlbumProposalViewContract>(
      `${this.base}/${encodeURIComponent(albumId)}/proposals`,
      input,
      { withCredentials: true },
    );
  }

  proposals(albumId: string): Observable<AlbumProposalsResponse> {
    return this.http.get<AlbumProposalsResponse>(
      `${this.base}/${encodeURIComponent(albumId)}/proposals`,
      { withCredentials: true },
    );
  }

  approveProposal(
    albumId: string,
    proposalId: string,
  ): Observable<AlbumProposalViewContract> {
    return this.http.post<AlbumProposalViewContract>(
      `${this.base}/${encodeURIComponent(albumId)}/proposals/${encodeURIComponent(proposalId)}/approve`,
      {},
      { withCredentials: true },
    );
  }

  rejectProposal(
    albumId: string,
    proposalId: string,
  ): Observable<AlbumProposalViewContract> {
    return this.http.post<AlbumProposalViewContract>(
      `${this.base}/${encodeURIComponent(albumId)}/proposals/${encodeURIComponent(proposalId)}/reject`,
      {},
      { withCredentials: true },
    );
  }

  listAssets(albumId: string): Observable<AlbumAssetsResponse> {
    return this.http.get<AlbumAssetsResponse>(
      `${this.base}/${encodeURIComponent(albumId)}/assets`,
      { withCredentials: true },
    );
  }

  /**
   * Multipart upload with progress events. Text fields are appended before
   * the `file` part because the backend validates them before streaming.
   * Session travels in cookies; no tokens are stored or sent manually.
   */
  uploadAsset(
    albumId: string,
    input: { storageConnectionId: string; sizeBytes: number; file: File },
  ): Observable<HttpEvent<AlbumAssetContract>> {
    const form = new FormData();
    form.append('storageConnectionId', input.storageConnectionId);
    form.append('sizeBytes', String(input.sizeBytes));
    form.append('file', input.file, input.file.name);
    return this.http.post<AlbumAssetContract>(
      `${this.base}/${encodeURIComponent(albumId)}/assets/upload`,
      form,
      { withCredentials: true, reportProgress: true, observe: 'events' },
    );
  }

  /** Same-origin content proxy; the browser sends session cookies itself. */
  contentUrl(albumId: string, assetId: string): string {
    return `${this.base}/${encodeURIComponent(albumId)}/assets/${encodeURIComponent(assetId)}/content`;
  }

  deleteAsset(albumId: string, assetId: string): Observable<SuccessResponse> {
    return this.http.delete<SuccessResponse>(
      `${this.base}/${encodeURIComponent(albumId)}/assets/${encodeURIComponent(assetId)}`,
      { withCredentials: true },
    );
  }
}
