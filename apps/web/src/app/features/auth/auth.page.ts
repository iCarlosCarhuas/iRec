import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { AuthStore } from '../../core/auth/auth-store.service';
import { uiError } from '../../core/http/ui-error';

type Mode = 'login' | 'register';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page auth-page">
      <section class="auth-layout">
        <aside class="auth-context">
          <a class="back-link" routerLink="/">← Volver a iRec</a>
          <p class="eyebrow">IDENTITY · 0.2.0</p>
          <h1>Tu acceso, sin contraseña.</h1>
          <p>
            iRec combina tu correo verificado con un codigo temporal de tu
            autenticador. Los tokens de sesion nunca quedan expuestos al
            JavaScript de la PWA.
          </p>

          <div class="context-points">
            <span>01 · Email</span>
            <span>02 · TOTP</span>
            <span>03 · Recovery codes</span>
          </div>
        </aside>

        <section class="auth-card">
          <div class="segmented" role="tablist" aria-label="Modo de acceso">
            <button
              type="button"
              [class.active]="mode() === 'login'"
              (click)="setMode('login')"
            >
              Entrar
            </button>
            <button
              type="button"
              [class.active]="mode() === 'register'"
              (click)="setMode('register')"
            >
              Crear acceso
            </button>
          </div>

          @if (auth.authenticated()) {
            <div class="notice success">
              Ya tienes una sesion activa como <strong>{{ auth.user()?.email }}</strong>.
            </div>
            <a class="button primary full" routerLink="/settings/security">
              Ir a seguridad
            </a>
          } @else if (mode() === 'login') {
            <div class="form-head">
              <span class="kicker">Bienvenido de vuelta</span>
              <h2>Ingresa a iRec</h2>
              <p>Usa el codigo de 6 digitos que aparece en tu autenticador.</p>
            </div>

            <form class="form-grid" (submit)="login($event)">
              <label>
                <span>Correo</span>
                <input
                  type="email"
                  autocomplete="email"
                  required
                  [value]="email()"
                  (input)="email.set($any($event.target).value)"
                  placeholder="tu@correo.com"
                />
              </label>

              <label>
                <span>Codigo TOTP</span>
                <input
                  class="otp-input"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                  minlength="6"
                  maxlength="6"
                  pattern="[0-9]{6}"
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
                  <small>Hasta 30 dias. Puedes revocarlo cuando quieras.</small>
                </span>
              </label>

              @if (error()) {
                <div class="notice error">{{ error() }}</div>
              }

              <button
                class="button primary full"
                type="submit"
                [disabled]="!canLogin()"
              >
                {{ busy() ? 'Comprobando…' : 'Entrar a iRec' }}
              </button>
            </form>

            <a class="inline-link" routerLink="/auth/recover">
              No tengo acceso a mi autenticador
            </a>
          } @else {
            <div class="form-head">
              <span class="kicker">Primer paso</span>
              <h2>Verifica tu correo</h2>
              <p>
                Te enviaremos un enlace de un solo uso. Luego configurarás el
                autenticador y recibirás tus recovery codes.
              </p>
            </div>

            <form class="form-grid" (submit)="startRegistration($event)">
              <label>
                <span>Correo</span>
                <input
                  type="email"
                  autocomplete="email"
                  required
                  [value]="registerEmail()"
                  (input)="registerEmail.set($any($event.target).value)"
                  placeholder="tu@correo.com"
                />
              </label>

              @if (registerMessage()) {
                <div class="notice success">{{ registerMessage() }}</div>
              }

              @if (error()) {
                <div class="notice error">{{ error() }}</div>
              }

              <button
                class="button primary full"
                type="submit"
                [disabled]="busy() || !registerEmail().trim()"
              >
                {{ busy() ? 'Enviando…' : 'Enviar enlace de verificacion' }}
              </button>
            </form>

            <p class="fine-print">
              La respuesta es deliberadamente neutra para no revelar si una
              cuenta ya existe.
            </p>
          }
        </section>
      </section>
    </main>
  `,
})
export class AuthPage {
  readonly auth = inject(AuthStore);
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly mode = signal<Mode>('login');
  readonly email = signal('');
  readonly code = signal('');
  readonly rememberDevice = signal(false);

  readonly registerEmail = signal('');
  readonly registerMessage = signal('');

  readonly busy = signal(false);
  readonly error = signal('');

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set('');
    this.registerMessage.set('');
  }

  normalizeCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  canLogin(): boolean {
    return (
      !this.busy() &&
      this.email().trim().length > 3 &&
      /^\d{6}$/.test(this.code())
    );
  }

  async login(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canLogin() || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    try {
      const session = await this.auth.login(
        this.email().trim(),
        this.code(),
        this.rememberDevice(),
      );

      if (!session.authenticated) {
        this.error.set('No se pudo abrir una sesion valida.');
        return;
      }

      await this.router.navigateByUrl('/albums');
    } catch (error) {
      this.error.set(
        uiError(error, 'Correo o codigo TOTP invalidos.'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async startRegistration(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.registerEmail().trim();
    if (!email || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.registerMessage.set('');

    try {
      const response = await firstValueFrom(this.api.startEmail(email));
      this.registerMessage.set(response.message);
    } catch (error) {
      this.error.set(uiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
