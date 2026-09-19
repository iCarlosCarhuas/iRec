import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { AlbumContract, AlbumVisibility } from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth-store.service';
import { uiError } from '../../core/http/ui-error';
import { AlbumApiService } from './album-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page albums-page">
      <header class="albums-head">
        <div>
          <p class="eyebrow">ALBUM CORE · 0.3.0</p>
          <h1>Mis albumes.</h1>
          <p>
            Crea un espacio, invita personas y decide que propuestas forman parte
            de la historia.
          </p>
        </div>

        <button class="button primary" type="button" (click)="toggleCreate()">
          {{ createOpen() ? 'Cerrar' : '+ Nuevo album' }}
        </button>
      </header>

      @if (createOpen()) {
        <section class="panel album-create-panel">
          <div class="panel-title-row">
            <div>
              <span class="panel-label">Nuevo album</span>
              <h2>Empieza con lo esencial</h2>
            </div>
          </div>

          <form class="album-form" (submit)="create($event)">
            <label>
              <span>Titulo</span>
              <input
                type="text"
                maxlength="160"
                required
                [value]="title()"
                (input)="title.set($any($event.target).value)"
                placeholder="Cumpleaños de Fatima"
              />
            </label>

            <label>
              <span>Descripcion</span>
              <textarea
                maxlength="2000"
                [value]="description()"
                (input)="description.set($any($event.target).value)"
                placeholder="Unas palabras para recordar de que trata este album."
              ></textarea>
            </label>

            <label>
              <span>Visibilidad</span>
              <select
                [value]="visibility()"
                (change)="setVisibility($any($event.target).value)"
              >
                <option value="private">Privado</option>
                <option value="public">Publico</option>
              </select>
            </label>

            @if (createError()) {
              <div class="notice error">{{ createError() }}</div>
            }

            <div class="button-row compact-actions">
              <button
                class="button primary"
                type="submit"
                [disabled]="creating() || !title().trim()"
              >
                {{ creating() ? 'Creando…' : 'Crear album' }}
              </button>
              <button class="button ghost" type="button" (click)="resetCreate()">
                Cancelar
              </button>
            </div>
          </form>
        </section>
      }

      @if (loading()) {
        <section class="panel loading-panel album-state-panel">
          <div class="loader"></div>
          <span>Cargando tus albumes…</span>
        </section>
      } @else if (error()) {
        <section class="panel album-state-panel">
          <div class="notice error">{{ error() }}</div>
          <button class="button ghost" type="button" (click)="load()">
            Reintentar
          </button>
        </section>
      } @else if (albums().length === 0) {
        <section class="panel empty-albums">
          <span class="album-empty-mark" aria-hidden="true">◎</span>
          <div>
            <span class="panel-label">Todavia no hay albumes</span>
            <h2>Crea el primero.</h2>
            <p>
              El album nace privado por defecto. Luego puedes hacerlo publico o
              invitar miembros.
            </p>
          </div>
          <button class="button primary" type="button" (click)="openCreate()">
            Crear mi primer album
          </button>
        </section>
      } @else {
        <section class="album-grid" aria-label="Mis albumes">
          @for (album of albums(); track album.id) {
            <a class="album-card" [routerLink]="['/albums', album.id]">
              <div class="album-card-top">
                <span class="visibility-badge" [class.public]="album.visibility === 'public'">
                  {{ album.visibility === 'public' ? 'Publico' : 'Privado' }}
                </span>
                <span class="album-arrow" aria-hidden="true">↗</span>
              </div>

              <div class="album-card-copy">
                <h2>{{ album.title }}</h2>
                <p>{{ album.description || 'Sin descripcion por ahora.' }}</p>
              </div>

              <div class="album-card-foot">
                <span>Actualizado {{ formatDate(album.updatedAt) }}</span>
                <span>{{ album.ownerId === currentUserId() ? 'Propietario' : 'Miembro' }}</span>
              </div>
            </a>
          }
        </section>
      }
    </main>
  `,
})
export class AlbumsPage implements OnInit {
  private readonly api = inject(AlbumApiService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);

  readonly albums = signal<readonly AlbumContract[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly createOpen = signal(false);
  readonly creating = signal(false);
  readonly createError = signal('');
  readonly title = signal('');
  readonly description = signal('');
  readonly visibility = signal<AlbumVisibility>('private');

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const result = await firstValueFrom(this.api.list());
      this.albums.set(result.albums);
    } catch (error) {
      this.error.set(uiError(error, 'No pudimos cargar tus albumes.'));
    } finally {
      this.loading.set(false);
    }
  }

  toggleCreate(): void {
    this.createOpen.update((value) => !value);
    this.createError.set('');
  }

  openCreate(): void {
    this.createOpen.set(true);
    this.createError.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetCreate(): void {
    this.createOpen.set(false);
    this.creating.set(false);
    this.createError.set('');
    this.title.set('');
    this.description.set('');
    this.visibility.set('private');
  }

  setVisibility(value: string): void {
    this.visibility.set(value === 'public' ? 'public' : 'private');
  }

  async create(event: Event): Promise<void> {
    event.preventDefault();
    const title = this.title().trim();
    if (!title || this.creating()) return;

    this.creating.set(true);
    this.createError.set('');

    try {
      const album = await firstValueFrom(
        this.api.create({
          title,
          description: this.description().trim() || null,
          visibility: this.visibility(),
        }),
      );
      await this.router.navigate(['/albums', album.id]);
    } catch (error) {
      this.createError.set(uiError(error, 'No pudimos crear el album.'));
    } finally {
      this.creating.set(false);
    }
  }

  currentUserId(): string | null {
    return this.auth.user()?.id ?? null;
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}
