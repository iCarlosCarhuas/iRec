import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { uiError } from '../../core/http/ui-error';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page auth-page">
      <section class="auth-layout">
        <aside class="auth-context">
          <a class="back-link" routerLink="/auth">← Volver al acceso</a>
          <p class="eyebrow">RECUPERACION</p>
          <h1>Recupera el control de tu cuenta.</h1>
          <p>
            Puedes usar un enlace enviado a tu correo verificado o uno de los
            recovery codes que guardaste al activar TOTP.
          </p>
        </aside>

        <section class="auth-card">
          @if (tokenMode()) {
            <div class="form-head">
              <span class="kicker">Enlace de recuperacion</span>
              <h2>{{ tokenVerified() ? 'Correo confirmado' : 'Validando enlace' }}</h2>
            </div>

            @if (busy()) {
              <div class="loader"></div>
            } @else if (tokenVerified()) {
              <div class="notice success">
                Ya puedes configurar un autenticador nuevo. Los dispositivos
                recordados anteriores quedaran invalidados.
              </div>
              <button class="button primary full" type="button" (click)="goTotp()">
                Configurar TOTP nuevo
              </button>
            } @else {
              <div class="notice error">{{ error() }}</div>
              <a class="button ghost full" routerLink="/auth/recover">
                Iniciar otra recuperacion
              </a>
            }
          } @else {
            <div class="segmented">
              <button
                type="button"
                [class.active]="method() === 'email'"
                (click)="setMethod('email')"
              >
                Por correo
              </button>
              <button
                type="button"
                [class.active]="method() === 'code'"
                (click)="setMethod('code')"
              >
                Recovery code
              </button>
            </div>

            @if (method() === 'email') {
              <div class="form-head">
                <span class="kicker">Opcion recomendada</span>
                <h2>Enviame un enlace</h2>
                <p>
                  Si el correo puede recuperar una cuenta, recibira
                  instrucciones. La respuesta siempre sera neutra.
                </p>
              </div>

              <form class="form-grid" (submit)="sendRecoveryEmail($event)">
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

                @if (message()) {
                  <div class="notice success">{{ message() }}</div>
                }

                @if (error()) {
                  <div class="notice error">{{ error() }}</div>
                }

                <button
                  class="button primary full"
                  type="submit"
                  [disabled]="busy() || !email().trim()"
                >
                  {{ busy() ? 'Enviando…' : 'Enviar enlace' }}
                </button>
              </form>
            } @else {
              <div class="form-head">
                <span class="kicker">Sin acceso al correo</span>
                <h2>Usa un recovery code</h2>
                <p>El codigo se consumira y no podra utilizarse otra vez.</p>
              </div>

              <form class="form-grid" (submit)="recoverWithCode($event)">
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
                  <span>Recovery code</span>
                  <input
                    type="text"
                    autocomplete="off"
                    required
                    [value]="recoveryCode()"
                    (input)="recoveryCode.set($any($event.target).value)"
                    placeholder="IREC-..."
                  />
                </label>

                @if (error()) {
                  <div class="notice error">{{ error() }}</div>
                }

                <button
                  class="button primary full"
                  type="submit"
                  [disabled]="busy() || !email().trim() || !recoveryCode().trim()"
                >
                  {{ busy() ? 'Validando…' : 'Recuperar acceso' }}
                </button>
              </form>
            }
          }
        </section>
      </section>
    </main>
  `,
})
export class RecoverPage implements OnInit {
  private readonly api = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly method = signal<'email' | 'code'>('email');
  readonly email = signal('');
  readonly recoveryCode = signal('');
  readonly message = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  readonly tokenMode = signal(false);
  readonly tokenVerified = signal(false);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.tokenMode.set(true);
      void this.verifyToken(token);
    }
  }

  setMethod(method: 'email' | 'code'): void {
    this.method.set(method);
    this.error.set('');
    this.message.set('');
  }

  async sendRecoveryEmail(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.email().trim() || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const result = await firstValueFrom(
        this.api.startRecoveryEmail(this.email().trim()),
      );
      this.message.set(result.message);
    } catch (error) {
      this.error.set(uiError(error));
    } finally {
      this.busy.set(false);
    }
  }

  async recoverWithCode(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.email().trim() || !this.recoveryCode().trim() || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    try {
      await firstValueFrom(
        this.api.recoverWithCode(
          this.email().trim(),
          this.recoveryCode().trim(),
        ),
      );
      await this.router.navigateByUrl('/auth/totp/setup');
    } catch (error) {
      this.error.set(
        uiError(error, 'El recovery code no es valido o ya fue utilizado.'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async goTotp(): Promise<void> {
    await this.router.navigateByUrl('/auth/totp/setup');
  }

  private async verifyToken(token: string): Promise<void> {
    this.busy.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.api.verifyRecoveryEmail(token));
      this.tokenVerified.set(true);
    } catch (error) {
      this.error.set(
        uiError(error, 'El enlace de recuperacion es invalido o expiro.'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
