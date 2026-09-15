import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { TotpEnrollResponse, TrustedDevice } from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { AuthStore } from '../../core/auth/auth-store.service';
import { uiError } from '../../core/http/ui-error';

@Component({
  standalone: true,
  template: `
    <main class="page security-page">
      <header class="section-head security-head">
        <div>
          <p class="eyebrow">CUENTA · SEGURIDAD</p>
          <h1>Tu identidad en iRec.</h1>
          <p>
            Administra los dispositivos recordados y rota tu autenticador
            cuando lo necesites.
          </p>
        </div>

        <button class="button ghost" type="button" (click)="logout()">
          Cerrar sesion
        </button>
      </header>

      <section class="security-grid">
        <article class="panel account-panel">
          <span class="panel-label">Cuenta</span>
          <div class="account-email">{{ auth.user()?.email }}</div>
          <dl class="detail-list">
            <div>
              <dt>Correo</dt>
              <dd>Verificado</dd>
            </div>
            <div>
              <dt>Acceso</dt>
              <dd>Email + TOTP</dd>
            </div>
            <div>
              <dt>Sesion web</dt>
              <dd>Cookies HttpOnly</dd>
            </div>
          </dl>
        </article>

        <article class="panel devices-panel">
          <div class="panel-title-row">
            <div>
              <span class="panel-label">Dispositivos recordados</span>
              <h2>Sesiones de confianza</h2>
            </div>
            @if (devices().length > 0) {
              <button
                class="mini-button danger"
                type="button"
                [disabled]="devicesBusy()"
                (click)="revokeAll()"
              >
                Revocar todos
              </button>
            }
          </div>

          @if (devicesBusy() && devices().length === 0) {
            <div class="loader"></div>
          } @else if (devicesError()) {
            <div class="notice error">{{ devicesError() }}</div>
          } @else if (devices().length === 0) {
            <p class="empty-state">
              No tienes dispositivos recordados activos.
            </p>
          } @else {
            <div class="device-list">
              @for (device of devices(); track device.id) {
                <div class="device-row">
                  <div class="device-icon" aria-hidden="true">◫</div>
                  <div class="device-copy">
                    <strong>{{ deviceName(device) }}</strong>
                    <small>
                      Creado {{ formatDate(device.createdAt) }} · expira
                      {{ formatDate(device.expiresAt) }}
                    </small>
                    @if (device.lastUsedAt) {
                      <small>Ultimo uso {{ formatDate(device.lastUsedAt) }}</small>
                    }
                  </div>
                  <button
                    class="mini-button"
                    type="button"
                    [disabled]="devicesBusy()"
                    (click)="revoke(device.id)"
                  >
                    Revocar
                  </button>
                </div>
              }
            </div>
          }
        </article>

        <article class="panel rotation-panel">
          <span class="panel-label">Autenticador</span>

          @if (!rotation()) {
            <h2>Rotar TOTP</h2>
            <p>
              Usa esta opcion si cambiaste de telefono o quieres reemplazar el
              secreto actual. Tus dispositivos recordados se revocaran al
              confirmar el nuevo TOTP.
            </p>

            <form class="inline-form" (submit)="startRotation($event)">
              <label>
                <span>Codigo TOTP actual</span>
                <input
                  class="otp-input"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  required
                  [value]="currentCode()"
                  (input)="currentCode.set(normalizeCode($any($event.target).value))"
                  placeholder="000000"
                />
              </label>

              <button
                class="button ghost"
                type="submit"
                [disabled]="!canStartRotation()"
              >
                {{ rotationBusy() ? 'Validando…' : 'Preparar rotacion' }}
              </button>
            </form>
          } @else if (rotation(); as setup) {
            <div class="rotation-setup">
              <div>
                <h2>Escanea el TOTP nuevo</h2>
                <p>
                  No elimines el secreto anterior hasta terminar esta
                  confirmacion.
                </p>
                <img class="small-qr" [src]="setup.qrDataUrl" alt="QR TOTP nuevo" />
                <code class="key-block">{{ setup.manualEntryKey }}</code>
              </div>

              <form class="form-grid" (submit)="confirmRotation($event)">
                <label>
                  <span>Codigo del TOTP nuevo</span>
                  <input
                    class="otp-input"
                    type="text"
                    inputmode="numeric"
                    maxlength="6"
                    required
                    [value]="newCode()"
                    (input)="newCode.set(normalizeCode($any($event.target).value))"
                    placeholder="000000"
                  />
                </label>

                <button
                  class="button primary"
                  type="submit"
                  [disabled]="!canConfirmRotation()"
                >
                  {{ rotationBusy() ? 'Confirmando…' : 'Confirmar TOTP nuevo' }}
                </button>
              </form>
            </div>
          }

          @if (rotationError()) {
            <div class="notice error">{{ rotationError() }}</div>
          }
        </article>
      </section>
    </main>
  `,
})
export class SecurityPage implements OnInit {
  readonly auth = inject(AuthStore);
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly devices = signal<readonly TrustedDevice[]>([]);
  readonly devicesBusy = signal(false);
  readonly devicesError = signal('');

  readonly currentCode = signal('');
  readonly newCode = signal('');
  readonly rotation = signal<TotpEnrollResponse | null>(null);
  readonly rotationBusy = signal(false);
  readonly rotationError = signal('');

  ngOnInit(): void {
    void this.loadDevices();
  }

  normalizeCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  canStartRotation(): boolean {
    return !this.rotationBusy() && /^\d{6}$/.test(this.currentCode());
  }

  canConfirmRotation(): boolean {
    return !this.rotationBusy() && /^\d{6}$/.test(this.newCode());
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  deviceName(device: TrustedDevice): string {
    const ua = device.userAgent?.toLowerCase() ?? '';

    if (ua.includes('edg/')) return 'Microsoft Edge';
    if (ua.includes('chrome/')) return 'Google Chrome';
    if (ua.includes('firefox/')) return 'Mozilla Firefox';
    if (ua.includes('safari/')) return 'Safari';
    return 'Dispositivo recordado';
  }

  async revoke(id: string): Promise<void> {
    if (this.devicesBusy()) return;
    this.devicesBusy.set(true);
    this.devicesError.set('');

    try {
      await firstValueFrom(this.api.revokeTrustedDevice(id));
      await this.loadDevices();
    } catch (error) {
      this.devicesError.set(uiError(error));
    } finally {
      this.devicesBusy.set(false);
    }
  }

  async revokeAll(): Promise<void> {
    if (this.devicesBusy()) return;
    this.devicesBusy.set(true);
    this.devicesError.set('');

    try {
      await firstValueFrom(this.api.revokeAllTrustedDevices());
      this.devices.set([]);
    } catch (error) {
      this.devicesError.set(uiError(error));
    } finally {
      this.devicesBusy.set(false);
    }
  }

  async startRotation(event: Event): Promise<void> {
    event.preventDefault();
    if (!/^\d{6}$/.test(this.currentCode()) || this.rotationBusy()) return;

    this.rotationBusy.set(true);
    this.rotationError.set('');

    try {
      this.rotation.set(
        await firstValueFrom(
          this.api.startTotpRotation(this.currentCode()),
        ),
      );
      this.newCode.set('');
    } catch (error) {
      this.rotationError.set(
        uiError(error, 'No pudimos validar el TOTP actual.'),
      );
    } finally {
      this.rotationBusy.set(false);
    }
  }

  async confirmRotation(event: Event): Promise<void> {
    event.preventDefault();
    if (!/^\d{6}$/.test(this.newCode()) || this.rotationBusy()) return;

    this.rotationBusy.set(true);
    this.rotationError.set('');

    try {
      const result = await firstValueFrom(
        this.api.confirmTotpRotation(this.newCode()),
      );
      this.auth.acceptRecoveryCodes(result);
      await this.router.navigateByUrl('/auth/recovery-codes');
    } catch (error) {
      this.rotationError.set(
        uiError(error, 'No pudimos activar el TOTP nuevo.'),
      );
    } finally {
      this.rotationBusy.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }

  private async loadDevices(): Promise<void> {
    this.devicesBusy.set(true);
    this.devicesError.set('');

    try {
      const result = await firstValueFrom(this.api.trustedDevices());
      this.devices.set(result.devices);
    } catch (error) {
      this.devicesError.set(uiError(error));
    } finally {
      this.devicesBusy.set(false);
    }
  }
}
