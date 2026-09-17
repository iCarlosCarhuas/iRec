import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthStore } from './core/auth/auth-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="app-frame">
      <header class="topbar">
        <a class="brand" routerLink="/" aria-label="Inicio iRec">
          <span class="brand-mark" aria-hidden="true">iR</span>
          <span>
            <strong>iRec</strong>
            <small>digital memories</small>
          </span>
        </a>

        <nav class="topnav" aria-label="Navegacion principal">
          @if (auth.authenticated()) {
            <span class="user-chip">{{ auth.user()?.email }}</span>
            <a routerLink="/settings/security">Seguridad</a>
            <button class="link-button" type="button" (click)="logout()">
              Salir
            </button>
          } @else {
            <a routerLink="/auth/recover">Recuperar acceso</a>
            <a class="nav-primary" routerLink="/auth">Entrar</a>
          }
        </nav>
      </header>

      <router-outlet />
    </div>
  `,
})
export class App {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  constructor() {
    void this.auth.restore();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
