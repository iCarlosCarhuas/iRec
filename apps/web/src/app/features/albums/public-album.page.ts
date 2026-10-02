import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { AlbumAssetContract, AlbumContract } from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { uiError } from '../../core/http/ui-error';
import { AuthStore } from '../../core/auth/auth-store.service';
import {
  AlbumApiService,
  isPreviewLimitedImageMime,
  isVideoAssetMime,
} from './album-api.service';

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

          <section class="public-album-content panel" aria-label="Recuerdos del album">
            <div>
              <span class="panel-label">Recuerdos</span>
              <h2>Fotos y videos publicados</h2>
              <p>
                Contenido listo del album, solo lectura. Los archivos se
                guardan en el Google Drive de su propietario y nunca se hacen
                publicos por enlace.
              </p>
            </div>

            @if (galleryLoading()) {
              <div class="loading-panel">
                <div class="loader"></div>
                <span>Cargando recuerdos…</span>
              </div>
            } @else if (galleryError()) {
              <div class="notice error">
                {{ galleryError() }}
                <div class="button-row">
                  <button class="button ghost" type="button" (click)="loadGallery()">
                    Reintentar
                  </button>
                </div>
              </div>
            } @else if (assets().length === 0) {
              <div>
                <div class="public-album-placeholder" aria-hidden="true">
                  <span></span><span></span><span></span>
                </div>
                <p class="empty-state">
                  Este album aun no tiene fotos ni videos publicados.
                </p>
              </div>
            } @else {
              <div class="asset-grid" aria-label="Galeria publica del album">
                @for (asset of assets(); track asset.id) {
                  @if (isVideoAsset(asset.mimeType)) {
                    <button
                      class="asset-thumb"
                      type="button"
                      [title]="asset.originalName"
                      [attr.aria-label]="'Ver video ' + asset.originalName"
                      (click)="openAsset(asset)"
                    >
                      <video [src]="contentUrl(asset)" preload="metadata" muted playsinline></video>
                      <span class="asset-badge">Video</span>
                    </button>
                  } @else {
                    <button
                      class="asset-thumb"
                      type="button"
                      [title]="asset.originalName"
                      [attr.aria-label]="'Ver foto ' + asset.originalName"
                      (click)="openAsset(asset)"
                    >
                      <img [src]="contentUrl(asset)" [alt]="asset.originalName" loading="lazy" />
                    </button>
                  }
                }
              </div>
            }
          </section>

          @if (activeAsset(); as current) {
            <div class="asset-dialog-backdrop" (click)="closeAsset()">
              <div
                class="asset-dialog panel"
                role="dialog"
                aria-modal="true"
                [attr.aria-label]="current.originalName"
                (click)="$event.stopPropagation()"
              >
                <h3>{{ current.originalName }}</h3>
                @if (isVideoAsset(current.mimeType)) {
                  <video [src]="contentUrl(current)" controls preload="metadata" playsinline></video>
                } @else {
                  <img [src]="contentUrl(current)" [alt]="current.originalName" />
                }
                @if (isPreviewLimitedImage(current.mimeType)) {
                  <p class="quiet-status">
                    La vista previa de heic/heif es limitada en algunos navegadores.
                  </p>
                }
                <div class="button-row asset-dialog-actions">
                  <button class="button ghost" type="button" (click)="closeAsset()">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          }

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

  readonly assets = signal<readonly AlbumAssetContract[]>([]);
  readonly galleryLoading = signal(false);
  readonly galleryError = signal('');
  readonly activeAsset = signal<AlbumAssetContract | null>(null);

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
      if (album.visibility !== 'public') {
        this.album.set(null);
        return;
      }
      this.album.set(album);
      await this.loadGallery();
    } catch {
      // Deliberately generic: do not reveal whether a private album exists.
      this.album.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async loadGallery(): Promise<void> {
    if (!this.albumId) return;
    this.galleryLoading.set(true);
    this.galleryError.set('');
    try {
      const result = await firstValueFrom(this.api.listPublicAssets(this.albumId));
      this.assets.set(result.assets);
      const active = this.activeAsset();
      if (active && !result.assets.some((asset) => asset.id === active.id)) {
        this.activeAsset.set(null);
      }
    } catch (error: unknown) {
      this.assets.set([]);
      this.galleryError.set(
        error instanceof Error && 'message' in error
          ? uiError(error, 'No pudimos cargar las fotos y videos.')
          : 'No pudimos cargar las fotos y videos.',
      );
    } finally {
      this.galleryLoading.set(false);
    }
  }

  contentUrl(asset: AlbumAssetContract): string {
    return this.api.publicContentUrl(this.albumId, asset.id);
  }

  isVideoAsset(mimeType: string): boolean {
    return isVideoAssetMime(mimeType);
  }

  isPreviewLimitedImage(mimeType: string): boolean {
    return isPreviewLimitedImageMime(mimeType);
  }

  openAsset(asset: AlbumAssetContract): void {
    this.activeAsset.set(asset);
  }

  closeAsset(): void {
    this.activeAsset.set(null);
  }

  async copyLink(): Promise<void> {
    if (typeof window === 'undefined') return;
    await navigator.clipboard.writeText(window.location.href);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1600);
  }
}
