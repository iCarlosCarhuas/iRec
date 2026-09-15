import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../core/auth/auth-store.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page home-page">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">iRec · Identity v0.2.0</p>
          <h1>Recuerdos que se sienten tuyos.</h1>
          <p class="hero-lead">
            Crea albumes digitales tematicos para conservar, ordenar y compartir
            momentos sin convertir tu identidad en otra contraseña que recordar.
          </p>

          <div class="hero-actions">
            @if (auth.authenticated()) {
              <a class="button primary" routerLink="/settings/security">
                Abrir mi cuenta
              </a>
            } @else {
              <a class="button primary" routerLink="/auth">Comenzar</a>
              <a class="button ghost" routerLink="/auth/recover">
                Recuperar acceso
              </a>
            }
          </div>

          <div class="trust-row">
            <span>Correo verificado</span>
            <span>TOTP</span>
            <span>Sin contraseña tradicional</span>
          </div>
        </div>

        <aside class="identity-preview" aria-label="Resumen de seguridad">
          <div class="preview-head">
            <span class="status-dot"></span>
            <span>Identity</span>
            <strong>v0.2.0</strong>
          </div>

          <div class="security-stack">
            <div class="security-row">
              <span class="security-number">01</span>
              <div>
                <strong>Verifica tu correo</strong>
                <small>El enlace dura pocos minutos.</small>
              </div>
            </div>
            <div class="security-row">
              <span class="security-number">02</span>
              <div>
                <strong>Activa tu autenticador</strong>
                <small>Google Authenticator o cualquier app TOTP.</small>
              </div>
            </div>
            <div class="security-row">
              <span class="security-number">03</span>
              <div>
                <strong>Guarda tus recovery codes</strong>
                <small>Se muestran una sola vez.</small>
              </div>
            </div>
          </div>

          <p class="preview-note">
            Los tokens de sesion viven en cookies HttpOnly. El frontend no los
            guarda en localStorage.
          </p>
        </aside>
      </section>
    </main>
  `,
})
export class HomePage {
  readonly auth = inject(AuthStore);
}
