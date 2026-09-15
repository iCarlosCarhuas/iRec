import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  EmailVerifyResponse,
  GenericAcceptedResponse,
  RecoveryCodesResponse,
  RecoveryReadyResponse,
  SessionResponse,
  SuccessResponse,
  TotpEnrollResponse,
  TrustedDevicesResponse,
} from '@irec/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/auth';

  startEmail(email: string): Observable<GenericAcceptedResponse> {
    return this.http.post<GenericAcceptedResponse>(
      `${this.base}/email/start`,
      { email },
      { withCredentials: true },
    );
  }

  verifyEmail(token: string): Observable<EmailVerifyResponse> {
    return this.http.post<EmailVerifyResponse>(
      `${this.base}/email/verify`,
      { token },
      { withCredentials: true },
    );
  }

  enrollTotp(): Observable<TotpEnrollResponse> {
    return this.http.post<TotpEnrollResponse>(
      `${this.base}/totp/enroll`,
      {},
      { withCredentials: true },
    );
  }

  confirmTotp(
    code: string,
    rememberDevice: boolean,
  ): Observable<RecoveryCodesResponse> {
    return this.http.post<RecoveryCodesResponse>(
      `${this.base}/totp/confirm`,
      { code, rememberDevice },
      { withCredentials: true },
    );
  }

  login(
    email: string,
    code: string,
    rememberDevice: boolean,
  ): Observable<SessionResponse> {
    return this.http.post<SessionResponse>(
      `${this.base}/login`,
      { email, code, rememberDevice },
      { withCredentials: true },
    );
  }

  session(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(
      `${this.base}/session`,
      { withCredentials: true },
    );
  }

  refresh(): Observable<SessionResponse> {
    return this.http.post<SessionResponse>(
      `${this.base}/refresh`,
      {},
      { withCredentials: true },
    );
  }

  logout(): Observable<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `${this.base}/logout`,
      {},
      { withCredentials: true },
    );
  }

  startRecoveryEmail(email: string): Observable<GenericAcceptedResponse> {
    return this.http.post<GenericAcceptedResponse>(
      `${this.base}/recovery/email`,
      { email },
      { withCredentials: true },
    );
  }

  verifyRecoveryEmail(token: string): Observable<RecoveryReadyResponse> {
    return this.http.post<RecoveryReadyResponse>(
      `${this.base}/recovery/email/verify`,
      { token },
      { withCredentials: true },
    );
  }

  recoverWithCode(
    email: string,
    recoveryCode: string,
  ): Observable<RecoveryReadyResponse> {
    return this.http.post<RecoveryReadyResponse>(
      `${this.base}/recovery/code`,
      { email, recoveryCode },
      { withCredentials: true },
    );
  }

  startTotpRotation(currentCode: string): Observable<TotpEnrollResponse> {
    return this.http.post<TotpEnrollResponse>(
      `${this.base}/totp/rotate`,
      { currentCode },
      { withCredentials: true },
    );
  }

  confirmTotpRotation(code: string): Observable<RecoveryCodesResponse> {
    return this.http.post<RecoveryCodesResponse>(
      `${this.base}/totp/rotate/confirm`,
      { code },
      { withCredentials: true },
    );
  }

  trustedDevices(): Observable<TrustedDevicesResponse> {
    return this.http.get<TrustedDevicesResponse>(
      `${this.base}/trusted-devices`,
      { withCredentials: true },
    );
  }

  revokeTrustedDevice(deviceId: string): Observable<SuccessResponse> {
    return this.http.delete<SuccessResponse>(
      `${this.base}/trusted-devices/${encodeURIComponent(deviceId)}`,
      { withCredentials: true },
    );
  }

  revokeAllTrustedDevices(): Observable<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `${this.base}/trusted-devices/revoke-all`,
      {},
      { withCredentials: true },
    );
  }
}
