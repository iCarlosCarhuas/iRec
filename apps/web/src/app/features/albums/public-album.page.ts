import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { AlbumContract } from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth-store.service';
import { AlbumApiService } from './album-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page public-album-page">
      <section class="public-album-shell">
        @if (loading()) {
          <div class="public-album-state panel">
            <div class="loader"></div>
            <span>Abriendo album…</span>
          </div>
        } @else if (!album()) {
          <div class="public-album-state panel">
            <span class="panel-label">Album no disponible</span>
            <h1>No pudimos mostrar este album.</h1>
            <p>
              Puede que sea privado, que el enlace ya no sea valido o que el album
              no exista.
            </p>
            <div class="button-row">
              <a class="button ghost" routerLink="/">Volver a iRec</a>
              @if (!auth.authenticated()) {
                <a class="button primary" routerLink="/auth">Entrar a iRec</a>
              }
            </div>
          </div>
        } @else if (album(); as current) {
          <header class="public-album-hero">
            <div class="public-album-kicker">
              <span class="visibility-badge public">Publico</span>
              <span>iRec album</span>
            </div>

            <h1>{{ current.title }}</h1>
            <p>{{ current.description || 'Este album aun no tiene descripcion.' }}</p>

            <div class="public-album-actions">
              <button class="button ghost" type="button" (click)="copyLink()">
                {{ copied() ? 'Enlace copiado' : 'Copiar enlace' }}
              </button>

              @if (auth.authenticated()) {
                <a class="button primary" [routerLink]="['/albums', current.id]">
                  Abrir en mi cuenta
                </a>
              } @else {
                <a class="button primary" routerLink="/auth">Crear mi album</a>
              }
            </div>
          </header>

          <section class="public-album-content panel">
            <div class="public-album-placeholder" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <div>
              <span class="panel-label">Recuerdos</span>
              <h2>Este album ya tiene una pagina publica.</h2>
              <p>
                Las fotos y videos publicados por su propietario apareceran aqui
                cuando el contenido multimedia este habilitado.
              </p>
            </div>
          </section>

          <footer class="public-album-footer">
            <a routerLink="/">iRec</a>
            <span>Album digital publico · solo lectura</span>
          </footer>
        }
      </section>
    </main>
  `,
})
export class PublicAlbumPage implements OnInit {
  private readonly api = inject(AlbumApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthStore);

  readonly album = signal<AlbumContract | null>(null);
  readonly loading = signal(true);
  readonly copied = signal(false);

  private readonly albumId = this.route.snapshot.paramMap.get('albumId') ?? '';

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (!this.albumId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    try {
      const album = await firstValueFrom(this.api.get(this.albumId));
      // This route is a share/public surface. Even an authenticated owner/member
      // must not make a private album look publicly shareable.
      this.album.set(album.visibility === 'public' ? album : null);
    } catch {
      // Deliberately generic: do not reveal whether a private album exists.
      this.album.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async copyLink(): Promise<void> {
    if (typeof window === 'undefined') return;
    await navigator.clipboard.writeText(window.location.href);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1600);
  }
}
