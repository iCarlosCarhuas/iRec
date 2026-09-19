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
          <p class="eyebrow">iRec · Album Core v0.3.0</p>
          <h1>Recuerdos que se sienten tuyos.</h1>
          <p class="hero-lead">
            Crea albumes digitales tematicos, invita a las personas correctas y
            decide juntos que momentos forman parte de la historia.
          </p>

          <div class="hero-actions">
            @if (auth.authenticated()) {
              <a class="button primary" routerLink="/albums">Abrir mis albumes</a>
              <a class="button ghost" routerLink="/settings/security">Seguridad</a>
            } @else {
              <a class="button primary" routerLink="/auth">Comenzar</a>
              <a class="button ghost" routerLink="/auth/recover">
                Recuperar acceso
              </a>
            }
          </div>

          <div class="trust-row">
            <span>Albumes publicos o privados</span>
            <span>Miembros</span>
            <span>Moderacion de propuestas</span>
          </div>
        </div>

        <aside class="identity-preview" aria-label="Resumen de Album Core">
          <div class="preview-head">
            <span class="status-dot"></span>
            <span>Album Core</span>
            <strong>v0.3.0</strong>
          </div>

          <div class="security-stack">
            <div class="security-row">
              <span class="security-number">01</span>
              <div>
                <strong>Crea tu album</strong>
                <small>Titulo, descripcion y visibilidad.</small>
              </div>
            </div>
            <div class="security-row">
              <span class="security-number">02</span>
              <div>
                <strong>Invita a tu gente</strong>
                <small>El owner conserva el control del album.</small>
              </div>
            </div>
            <div class="security-row">
              <span class="security-number">03</span>
              <div>
                <strong>Modera propuestas</strong>
                <small>Aprueba o rechaza antes de incorporar contenido.</small>
              </div>
            </div>
          </div>

          <p class="preview-note">
            Identity sigue protegiendo cada cuenta con correo verificado, TOTP y
            cookies HttpOnly.
          </p>
        </aside>
      </section>
    </main>
  `,
})
export class HomePage {
  readonly auth = inject(AuthStore);
}
