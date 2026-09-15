import { computed, inject, Injectable, signal } from '@angular/core';
import type { RecoveryCodesResponse, SessionResponse, SessionUser } from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from './auth-api.service';

const anonymousSession: SessionResponse = { authenticated: false };

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApiService);

  private readonly _session = signal<SessionResponse>(anonymousSession);
  private readonly _restoring = signal(false);
  private readonly _recoveryCodes = signal<readonly string[]>([]);

  readonly session = this._session.asReadonly();
  readonly restoring = this._restoring.asReadonly();
  readonly recoveryCodes = this._recoveryCodes.asReadonly();

  readonly authenticated = computed(() => this._session().authenticated);
  readonly user = computed<SessionUser | null>(() => {
    const session = this._session();
    return session.authenticated ? session.user : null;
  });

  private restorePromise?: Promise<SessionResponse>;

  async restore(force = false): Promise<SessionResponse> {
    if (!force && this.restorePromise) {
      return this.restorePromise;
    }

    this._restoring.set(true);

    this.restorePromise = firstValueFrom(this.api.session())
      .then((session) => {
        this._session.set(session);
        return session;
      })
      .catch(() => {
        this._session.set(anonymousSession);
        return anonymousSession;
      })
      .finally(() => this._restoring.set(false));

    return this.restorePromise;
  }

  async login(
    email: string,
    code: string,
    rememberDevice: boolean,
  ): Promise<SessionResponse> {
    const session = await firstValueFrom(
      this.api.login(email, code, rememberDevice),
    );
    this._session.set(session);
    this.restorePromise = Promise.resolve(session);
    return session;
  }

  acceptRecoveryCodes(result: RecoveryCodesResponse): void {
    this._session.set({
      authenticated: true,
      user: result.user,
    });
    this._recoveryCodes.set([...result.recoveryCodes]);
    this.restorePromise = Promise.resolve(this._session());
  }

  clearRecoveryCodes(): void {
    this._recoveryCodes.set([]);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this._session.set(anonymousSession);
      this._recoveryCodes.set([]);
      this.restorePromise = Promise.resolve(anonymousSession);
    }
  }
}
