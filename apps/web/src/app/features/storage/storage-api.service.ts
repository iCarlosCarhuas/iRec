import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  StorageConnectionContract,
  StorageConnectionsResponse,
} from '@irec/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StorageApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/storage/connections';

  list(): Observable<StorageConnectionsResponse> {
    return this.http.get<StorageConnectionsResponse>(this.base, {
      withCredentials: true,
    });
  }

  prepare(connectionId: string): Observable<StorageConnectionContract> {
    return this.http.post<StorageConnectionContract>(
      `${this.base}/${encodeURIComponent(connectionId)}/prepare`,
      {},
      { withCredentials: true },
    );
  }
}
