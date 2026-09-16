import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { uiError } from '../../core/http/ui-error';

type Status = 'checking' | 'success' | 'error';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page centered-page">
      <section class="compact-card">
        <div class="brand-mark large" aria-hidden="true">iR</div>

        @if (status() === 'checking') {
          <p class="eyebrow">VERIFICANDO</p>
          <h1>Un momento.</h1>
          <p>Estamos validando el enlace de tu correo.</p>
          <div class="loader" aria-label="Verificando"></div>
        } @else if (status() === 'success') {
          <p class="eyebrow">CORREO VERIFICADO</p>
          <h1>Ahora protege tu acceso.</h1>
          <p>
            El correo ya quedó confirmado. El siguiente paso es enlazar una app
            de autenticacion.
          </p>
          <a class="button primary full" routerLink="/auth/totp/setup">
            Configurar autenticador
          </a>
        } @else {
          <p class="eyebrow">NO PUDIMOS VERIFICAR</p>
          <h1>Este enlace ya no sirve.</h1>
          <div class="notice error">{{ error() }}</div>
          <a class="button ghost full" routerLink="/auth">
            Solicitar un enlace nuevo
          </a>
        }
      </section>
    </main>
  `,
})
export class VerifyEmailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AuthApiService);

  readonly status = signal<Status>('checking');
  readonly error = signal('');

  ngOnInit(): void {
    void this.verify();
  }

  private async verify(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status.set('error');
      this.error.set('El enlace no contiene un token de verificacion.');
      return;
    }

    try {
      await firstValueFrom(this.api.verifyEmail(token));
      this.status.set('success');
    } catch (error) {
      this.status.set('error');
      this.error.set(
        uiError(error, 'El token es invalido o ya expiro.'),
      );
    }
  }
}
