import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { TotpEnrollResponse } from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { AuthStore } from '../../core/auth/auth-store.service';
import { uiError } from '../../core/http/ui-error';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page setup-page">
      <section class="setup-shell">
        <header class="section-head">
          <a class="back-link" routerLink="/auth">← Acceso</a>
          <p class="eyebrow">PASO 2 DE 3</p>
          <h1>Enlaza tu autenticador.</h1>
          <p>
            Escanea el QR con Google Authenticator, Microsoft Authenticator,
            1Password o cualquier app compatible con TOTP.
          </p>
        </header>

        <section class="totp-help">
          <div class="totp-help-head">
            <div>
              <span class="panel-label">Primera vez con TOTP</span>
              <h2>¿No tienes una app de autenticacion?</h2>
              <p>
                Te guiamos desde la instalacion hasta el primer codigo.
                Puedes usar Google Authenticator, Microsoft Authenticator,
                1Password u otra app compatible con TOTP.
              </p>
            </div>

            <button
              class="mini-button"
              type="button"
              (click)="showGuide.set(!showGuide())"
              [attr.aria-expanded]="showGuide()"
            >
              {{ showGuide() ? 'Ocultar guia' : 'Ver paso a paso' }}
            </button>
          </div>

          @if (showGuide()) {
            <ol class="totp-steps">
              <li>
                <span class="totp-step-number">01</span>
                <div>
                  <strong>Instala una app TOTP</strong>
                  <p>
                    Abre la tienda oficial de tu telefono y busca
                    <a
                      href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                      target="_blank"
                      rel="noopener noreferrer"
                    ><b>Google Authenticator</b></a>,
                    <a
                      href="https://play.google.com/store/apps/details?id=com.azure.authenticator"
                      target="_blank"
                      rel="noopener noreferrer"
                    ><b>Microsoft Authenticator</b></a>,
                    <a
                      href="https://play.google.com/store/apps/details?id=com.onepassword.android"
                      target="_blank"
                      rel="noopener noreferrer"
                    ><b>1Password</b></a> u otra app que indique compatibilidad TOTP.
                    Verifica siempre el desarrollador antes de instalar.
                  </p>
                </div>
              </li>

              <li>
                <span class="totp-step-number">02</span>
                <div>
                  <strong>Abre la app y agrega una cuenta</strong>
                  <p>
                    Normalmente encontraras un boton <b>+</b>,
                    <b>Agregar cuenta</b> o una opcion equivalente.
                  </p>
                </div>
              </li>

              <li>
                <span class="totp-step-number">03</span>
                <div>
                  <strong>Elige “Escanear codigo QR”</strong>
                  <p>
                    Concede acceso a la camara solo mientras escaneas el QR.
                    Si no puedes usar la camara, copia la clave manual que iRec
                    muestra debajo del QR.
                  </p>
                </div>
              </li>

              <li>
                <span class="totp-step-number">04</span>
                <div>
                  <strong>Escanea el QR de iRec</strong>
                  <p>
                    La app creara una entrada para iRec y empezara a mostrar un
                    codigo de 6 digitos que cambia aproximadamente cada
                    30 segundos.
                  </p>
                </div>
              </li>

              <li>
                <span class="totp-step-number">05</span>
                <div>
                  <strong>Vuelve a iRec y escribe el codigo actual</strong>
                  <p>
                    Coloca los 6 digitos en el campo de confirmacion y pulsa
                    <b>Activar TOTP</b>. No necesitas copiar el QR ni guardarlo.
                  </p>
                </div>
              </li>
            </ol>

            <div class="totp-help-actions">
              <button
                class="button ghost"
                type="button"
                (click)="showVideo.set(!showVideo())"
                [attr.aria-expanded]="showVideo()"
              >
                {{ showVideo() ? 'Ocultar tutorial animado' : 'Ver tutorial animado · HyperFrames' }}
              </button>

              <span>
                El tutorial usa datos ficticios: nunca muestra tu QR ni tu
                clave real.
              </span>
            </div>

            @if (showVideo()) {
              <section class="totp-video-inline" aria-label="Tutorial animado TOTP">
                <div class="totp-video-heading">
                  <div>
                    <span class="panel-label">Tutorial dentro de esta misma ruta</span>
                    <strong>Google Authenticator → iRec</strong>
                  </div>
                  <span class="totp-video-duration">≈ 26 s</span>
                </div>

                <iframe
                  class="totp-video-frame"
                  src="/tutorials/totp-onboarding/player.html?embedded=1"
                  title="Tutorial de configuracion TOTP en iRec"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                ></iframe>

                <p class="totp-video-note">
                  La interfaz de cada autenticador puede variar ligeramente por
                  versión. En Microsoft Authenticator, para una cuenta iRec usa
                  <b>+ → Otra cuenta → Escanear un codigo QR</b>.
                </p>
              </section>
            }
          }
        </section>

        @if (loading()) {
          <div class="panel loading-panel">
            <div class="loader"></div>
            <span>Generando tu secreto TOTP…</span>
          </div>
        } @else if (error() && !enrollment()) {
          <div class="panel">
            <div class="notice error">{{ error() }}</div>
            <a class="button ghost" routerLink="/auth">
              Reiniciar el registro
            </a>
          </div>
        } @else if (enrollment(); as data) {
          <div class="totp-grid">
            <section class="panel qr-panel">
              <span class="panel-label">Escanea este QR</span>
              <div class="qr-wrap">
                <img [src]="data.qrDataUrl" alt="Codigo QR para configurar TOTP" />
              </div>

              <div class="manual-key">
                <span>Clave manual</span>
                <code>{{ data.manualEntryKey }}</code>
                <button class="mini-button" type="button" (click)="copyKey(data.manualEntryKey)">
                  {{ copied() ? 'Copiado' : 'Copiar' }}
                </button>
              </div>
            </section>

            <section class="panel confirm-panel">
              <span class="panel-label">Confirma que funciona</span>
              <h2>Escribe el codigo actual</h2>
              <p>
                Debe ser un codigo de 6 digitos generado por la app que acabas
                de configurar.
              </p>

              <form class="form-grid" (submit)="confirm($event)">
                <label>
                  <span>Codigo TOTP</span>
                  <input
                    class="otp-input large"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    pattern="[0-9]{6}"
                    required
                    [value]="code()"
                    (input)="code.set(normalizeCode($any($event.target).value))"
                    placeholder="000000"
                  />
                </label>

                <label class="check-row">
                  <input
                    type="checkbox"
                    [checked]="rememberDevice()"
                    (change)="rememberDevice.set($any($event.target).checked)"
                  />
                  <span>
                    <strong>Recordar este dispositivo</strong>
                    <small>Podras revocarlo desde Seguridad.</small>
                  </span>
                </label>

                @if (error()) {
                  <div class="notice error">{{ error() }}</div>
                }

                <button
                  class="button primary full"
                  type="submit"
                  [disabled]="!canConfirm()"
                >
                  {{ busy() ? 'Confirmando…' : 'Activar TOTP' }}
                </button>
              </form>
            </section>
          </div>
        }
      </section>
    </main>
  `,
})
export class TotpSetupPage implements OnInit {
  private readonly api = inject(AuthApiService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly enrollment = signal<TotpEnrollResponse | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly copied = signal(false);
  readonly error = signal('');
  readonly code = signal('');
  readonly rememberDevice = signal(false);
  readonly showGuide = signal(false);
  readonly showVideo = signal(false);

  ngOnInit(): void {
    void this.loadEnrollment();
  }

  normalizeCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  canConfirm(): boolean {
    return !this.busy() && /^\d{6}$/.test(this.code());
  }

  async copyKey(key: string): Promise<void> {
    await navigator.clipboard.writeText(key);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1800);
  }

  async confirm(event: Event): Promise<void> {
    event.preventDefault();
    if (!/^\d{6}$/.test(this.code()) || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    try {
      const result = await firstValueFrom(
        this.api.confirmTotp(this.code(), this.rememberDevice()),
      );
      this.auth.acceptRecoveryCodes(result);
      await this.router.navigateByUrl('/auth/recovery-codes');
    } catch (error) {
      this.error.set(uiError(error, 'No pudimos confirmar ese codigo.'));
    } finally {
      this.busy.set(false);
    }
  }

  private async loadEnrollment(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      this.enrollment.set(await firstValueFrom(this.api.enrollTotp()));
    } catch (error) {
      this.error.set(
        uiError(error, 'El flujo de enrolamiento expiro o no es valido.'),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
