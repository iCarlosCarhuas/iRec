import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
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
}
