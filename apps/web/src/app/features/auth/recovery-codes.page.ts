import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../core/auth/auth-store.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page centered-page wide">
      <section class="recovery-card">
        <p class="eyebrow">PASO 3 DE 3</p>
        <h1>Guarda tus recovery codes.</h1>
        <p class="lead-small">
          Cada codigo funciona una sola vez. iRec no puede volver a mostrar
          estos mismos codigos despues de salir de esta pantalla.
        </p>

        @if (codes().length === 10) {
          <div class="recovery-grid" aria-label="Codigos de recuperacion">
            @for (code of codes(); track code; let index = $index) {
              <div class="recovery-code">
                <span>{{ pad(index + 1) }}</span>
                <code>{{ code }}</code>
              </div>
            }
          </div>

          <div class="button-row">
            <button class="button ghost" type="button" (click)="copyAll()">
              {{ copied() ? 'Copiados' : 'Copiar todos' }}
            </button>
            <button class="button ghost" type="button" (click)="download()">
              Descargar .txt
            </button>
          </div>

          <label class="check-row confirm-save">
            <input
              type="checkbox"
              [checked]="saved()"
              (change)="saved.set($any($event.target).checked)"
            />
            <span>
              <strong>Ya los guarde en un lugar seguro</strong>
              <small>No los envies por correo ni los dejes en una nota publica.</small>
            </span>
          </label>

          <button
            class="button primary full"
            type="button"
            [disabled]="!saved()"
            (click)="continue()"
          >
            Continuar a mi cuenta
          </button>
        } @else {
          <div class="notice warning">
            Estos codigos ya no estan disponibles en memoria. Por seguridad no
            se guardan en el navegador.
          </div>

          @if (auth.authenticated()) {
            <a class="button primary full" routerLink="/settings/security">
              Ir a Seguridad
            </a>
          } @else {
            <a class="button primary full" routerLink="/auth">
              Volver a ingresar
            </a>
          }
        }
      </section>
    </main>
  `,
})
export class RecoveryCodesPage {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly codes = this.auth.recoveryCodes;
  readonly copied = signal(false);
  readonly saved = signal(false);

  pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  async copyAll(): Promise<void> {
    await navigator.clipboard.writeText(this.asText());
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1800);
  }

  download(): void {
    const blob = new Blob([this.asText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'irec-recovery-codes.txt';
    anchor.click();

    URL.revokeObjectURL(url);
  }

  async continue(): Promise<void> {
    if (!this.saved()) return;
    this.auth.clearRecoveryCodes();
    await this.router.navigateByUrl('/settings/security');
  }

  private asText(): string {
    return [
      'iRec recovery codes',
      '===================',
      '',
      ...this.codes().map((code, index) => `${this.pad(index + 1)}  ${code}`),
      '',
      'Cada codigo funciona una sola vez.',
    ].join('\n');
  }
}
