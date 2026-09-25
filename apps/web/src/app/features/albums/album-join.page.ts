import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { uiError } from '../../core/http/ui-error';
import { AlbumApiService } from './album-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page centered-page">
      <section class="compact-card album-join-card">
        <span class="panel-label">Invitacion de album</span>
        <h1>Unete al album.</h1>
        <p>
          Si tu cuenta tiene una invitacion pendiente para este album, al aceptar
          pasaras a ser miembro activo y podras verlo desde Mis albumes.
        </p>

        @if (error()) {
          <div class="notice error">{{ error() }}</div>
        }

        @if (accepted()) {
          <div class="notice success">Invitacion aceptada. Abriendo el album…</div>
        } @else {
          <button
            class="button primary full"
            type="button"
            [disabled]="busy()"
            (click)="accept()"
          >
            {{ busy() ? 'Aceptando…' : 'Aceptar invitacion' }}
          </button>
        }

        <a class="button ghost full" routerLink="/albums">Volver a Mis albumes</a>
      </section>
    </main>
  `,
})
export class AlbumJoinPage {
  private readonly api = inject(AlbumApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly accepted = signal(false);
  readonly error = signal('');

  private readonly albumId = this.route.snapshot.paramMap.get('albumId') ?? '';

  async accept(): Promise<void> {
    if (!this.albumId || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.api.accept(this.albumId));
      this.accepted.set(true);
      await this.router.navigate(['/albums', this.albumId]);
    } catch (error) {
      this.error.set(
        uiError(error, 'La invitacion no existe, ya fue usada o dejo de estar disponible.'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
