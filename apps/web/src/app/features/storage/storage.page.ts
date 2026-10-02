import { DOCUMENT } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import type { StorageConnectionContract } from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { uiError } from '../../core/http/ui-error';
import { StorageApiService } from './storage-api.service';

@Component({
  standalone: true,
  template: `
    <main class="page storage-page">
      <header class="section-head">
        <p class="eyebrow">CUENTA · ALMACENAMIENTO</p>
        <h1>Tu Google Drive.</h1>
        <p>
          Conecta tu cuenta y prepara la carpeta iRec en tu propio Drive.
          Abrir esta pagina no crea ni verifica carpetas en Google.
        </p>
      </header>

      <section class="panel" aria-labelledby="connections-title">
        <div class="panel-title-row">
          <div>
            <h2 id="connections-title">Conexiones de Google Drive</h2>
            <p>
              Google te pedira autorizacion. Para reconectar, elige la misma
              cuenta de Google que usaste antes.
            </p>
          </div>
          <button
            class="button primary"
            type="button"
            [disabled]="connecting() || loading() || preparingId() !== null"
            (click)="connectGoogle()"
          >
            {{ connecting() ? 'Abriendo Google…' : 'Conectar Google Drive' }}
          </button>
        </div>

        <p class="history-note" id="storage-history">
          El estado guardado y la ultima verificacion son historicos: no
          garantizan que Drive este disponible ahora. Preparar o verificar
          comprueba el acceso y crea la carpeta iRec si hace falta.
          La carga de fotos y videos aun no esta disponible aqui.
        </p>

        <div class="button-row">
          <button
            class="button ghost"
            type="button"
            [disabled]="loading() || connecting() || preparingId() !== null"
            (click)="loadConnections()"
          >
            {{ loading() ? 'Cargando conexiones…' : loadError() ? 'Reintentar lista' : 'Actualizar lista' }}
          </button>
        </div>

        <div role="status" aria-live="polite" class="load-status">
          @if (loading()) {
            Cargando conexiones guardadas. No se esta consultando Google Drive.
          }
          @if (connecting()) {
            Abriendo la autorizacion de Google Drive…
          }
        </div>
        @if (connectError()) {
          <div class="notice error" role="alert">{{ connectError() }}</div>
        }
        @if (loadError()) {
          <div class="notice error" role="alert">
            {{ loadError() }} Reintenta la lista.
            @if (connections().length > 0) {
              Se conserva la ultima lista cargada; no se ha actualizado.
            }
          </div>
        }

        <div class="connection-list" [attr.aria-busy]="loading()">
          @if (!loading() && !loadError() && connections().length === 0) {
            <p class="empty-state">
              Aun no tienes conexiones. Conecta Google Drive y despues pulsa
              Preparar carpeta iRec para comprobar el acceso.
            </p>
          }
          @for (connection of connections(); track connection.id) {
            <article class="connection-row" aria-describedby="storage-history">
              <h3>{{ connection.displayName || 'Google Drive' }}</h3>
              <dl class="detail-list">
                <div>
                  <dt>Estado guardado</dt>
                  <dd>{{ statusLabel(connection.status) }}</dd>
                </div>
                <div>
                  <dt>Ultima verificacion exitosa</dt>
                  <dd>{{ formatDate(connection.lastVerifiedAt) }}</dd>
                </div>
              </dl>
              @if (connection.status === 'revoked' || connection.status === 'error') {
                <p>Si el acceso ya no es valido, reconecta Google Drive con la misma cuenta.</p>
              }
              <div class="button-row">
                <button
                  class="button ghost"
                  type="button"
                  [disabled]="loading() || !!loadError() || connecting() || preparingId() !== null"
                  [attr.aria-label]="prepareLabel(connection) + ' — ' + (connection.displayName || 'Google Drive')"
                  (click)="prepare(connection)"
                >
                  {{ preparingId() === connection.id ? 'Verificando Drive…' : prepareLabel(connection) }}
                </button>
              </div>
              <div role="status" aria-live="polite">
                @if (preparingId() === connection.id) {
                  Comprobando el acceso y preparando la carpeta iRec…
                }
                @if (prepareSuccess()[connection.id]) {
                  <div class="notice success">{{ prepareSuccess()[connection.id] }}</div>
                }
              </div>
              @if (prepareErrors()[connection.id]) {
                <div class="notice error" role="alert">
                  {{ prepareErrors()[connection.id] }}
                  Este intento no confirma el acceso actual. El estado guardado
                  y la ultima verificacion exitosa se conservan. Puedes
                  reintentar o reconectar con la misma cuenta.
                </div>
              }
            </article>
          }
        </div>
      </section>
    </main>
  `,
  styles: `
    .storage-page { max-width: 960px; }
    .panel-title-row { flex-wrap: wrap; align-items: center; }
    .panel-title-row > div { flex: 1 1 300px; min-width: 0; }
    .panel-title-row .button { flex-shrink: 0; }
    .panel .history-note { margin-top: 24px; max-width: 75ch; }
    .button-row { margin-top: 18px; }
    .load-status:not(:empty), .notice { margin-top: 16px; }
    .load-status, [role="status"] { color: var(--muted); font-size: 13px; line-height: 1.6; }
    .connection-list { margin-top: 24px; }
    .connection-row { border-top: 1px solid var(--border); padding: 24px 0; }
    h3 { margin: 0 0 16px; overflow-wrap: anywhere; }
    .detail-list dt { color: var(--muted); }
    .detail-list dd { text-align: right; overflow-wrap: anywhere; }
    .button:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
    @media (max-width: 640px) {
      .storage-page { padding-top: 28px; }
      .panel-title-row .button { width: 100%; }
      .detail-list > div { flex-wrap: wrap; gap: 8px; }
      .detail-list dd { text-align: left; }
    }
  `,
})
export class StoragePage implements OnInit {
  private readonly api = inject(StorageApiService);
  private readonly document = inject(DOCUMENT);

  readonly connections = signal<readonly StorageConnectionContract[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly connecting = signal(false);
  readonly connectError = signal('');
  readonly preparingId = signal<string | null>(null);
  readonly prepareErrors = signal<Record<string, string>>({});
  readonly prepareSuccess = signal<Record<string, string>>({});

  ngOnInit(): void {
    void this.loadConnections();
  }

  @HostListener('window:pageshow')
  onPageShow(): void {
    // Browser back/forward cache can restore the page after leaving for OAuth.
    this.connecting.set(false);
  }

  connectGoogle(): void {
    if (this.connecting() || this.loading() || this.preparingId() !== null) return;
    this.connectError.set('');
    this.connecting.set(true);
    try {
      const window = this.document.defaultView;
      if (!window) throw new Error('Browser navigation unavailable');
      // Navigate to the backend; never fetch or expose OAuth codes or tokens.
      // Bypass already-installed workers that still treat /api as app navigation.
      window.location.assign('/api/storage/google/connect?ngsw-bypass=true');
    } catch {
      this.connecting.set(false);
      this.connectError.set('No pudimos abrir Google. Vuelve a pulsar Conectar Google Drive.');
    }
  }

  async loadConnections(): Promise<void> {
    if (this.loading() || this.connecting() || this.preparingId() !== null) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      const result = await firstValueFrom(this.api.list());
      this.connections.set(result.connections);
    } catch (error) {
      this.loadError.set(uiError(error, 'No pudimos cargar las conexiones.'));
    } finally {
      this.loading.set(false);
    }
  }

  async prepare(connection: StorageConnectionContract): Promise<void> {
    if (this.loading() || this.loadError() || this.connecting() || this.preparingId() !== null) return;
    this.preparingId.set(connection.id);
    this.prepareErrors.update((errors) => ({ ...errors, [connection.id]: '' }));
    this.prepareSuccess.update((messages) => ({ ...messages, [connection.id]: '' }));
    try {
      const verified = await firstValueFrom(this.api.prepare(connection.id));
      this.connections.update((connections) => connections.map((item) =>
        item.id === connection.id ? verified : item,
      ));
      this.prepareSuccess.update((messages) => ({
        ...messages, [connection.id]: 'Carpeta iRec preparada y acceso verificado en este intento.',
      }));
    } catch (error) {
      // A failed attempt is independent of the historical DTO; never mark it ready.
      this.prepareErrors.update((errors) => ({
        ...errors, [connection.id]: uiError(error, 'No pudimos preparar Google Drive.'),
      }));
    } finally {
      this.preparingId.set(null);
    }
  }

  prepareLabel(connection: StorageConnectionContract): string {
    if (this.prepareErrors()[connection.id]) return 'Reintentar preparacion';
    return connection.lastVerifiedAt ? 'Verificar carpeta iRec' : 'Preparar carpeta iRec';
  }

  statusLabel(status: StorageConnectionContract['status']): string {
    return { pending: 'Pendiente', ready: 'Preparada (historico)', error: 'Error registrado', revoked: 'Revocada' }[status];
  }

  formatDate(value: string | null): string {
    if (!value) return 'Nunca verificada';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
