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
            <a class="nav-primary" routerLink="/albums">Mis albumes</a>
            <span class="user-chip">{{ auth.user()?.email }}</span>
            <a class="nav-storage" routerLink="/settings/storage">Almacenamiento</a>
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
  styles: `
    .topnav { flex-wrap: wrap; justify-content: flex-end; }
    .topnav a.nav-storage { display: inline-flex; }
    .topnav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
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
