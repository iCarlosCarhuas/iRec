import { HttpEventType } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  MAX_ALBUM_ASSET_SIZE_BYTES,
  type AlbumAssetContract,
  type AlbumContract,
  type AlbumMemberViewContract,
  type AlbumProposalViewContract,
  type AlbumVisibility,
  type StorageConnectionContract,
} from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth-store.service';
import { uiError } from '../../core/http/ui-error';
import { StorageApiService } from '../storage/storage-api.service';
import { AlbumApiService } from './album-api.service';

const PREFERRED_CONNECTION_KEY = 'irec.preferredStorageConnectionId';
const ALLOWED_UPLOAD_MIME = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page album-detail-page">
      <a class="back-link" routerLink="/albums">← Mis albumes</a>

      @if (loading()) {
        <section class="panel loading-panel album-state-panel">
          <div class="loader"></div>
          <span>Cargando album…</span>
        </section>
      } @else if (error() && !album()) {
        <section class="panel album-state-panel">
          <div class="notice error">{{ error() }}</div>
          <a class="button ghost" routerLink="/albums">Volver a Mis albumes</a>
        </section>
      } @else if (album(); as current) {
        <header class="album-detail-head">
          <div>
            <div class="album-meta-row">
              <span class="visibility-badge" [class.public]="current.visibility === 'public'">
                {{ current.visibility === 'public' ? 'Publico' : 'Privado' }}
              </span>
              @if (isOwner()) {
                <span class="role-badge">Propietario</span>
              } @else if (myMembership(); as membership) {
                <span class="role-badge">{{ membership.status === 'active' ? 'Miembro' : membership.status }}</span>
              } @else {
                <span class="role-badge">Solo lectura</span>
              }
            </div>

            <h1>{{ current.title }}</h1>
            <p>{{ current.description || 'Este album aun no tiene descripcion.' }}</p>
          </div>

          <div class="album-head-actions">
            @if (current.visibility === 'public') {
              <a class="button ghost" [routerLink]="['/a', current.id]">
                Vista publica
              </a>
              <button class="mini-button" type="button" (click)="copyPublicLink()">
                {{ publicLinkCopied() ? 'Enlace copiado' : 'Copiar enlace' }}
              </button>
            }
            @if (isOwner()) {
              <button class="button ghost" type="button" (click)="toggleEdit()">
                {{ editOpen() ? 'Cerrar edicion' : 'Editar album' }}
              </button>
            }
          </div>
        </header>

        @if (error()) {
          <div class="notice error album-inline-notice">{{ error() }}</div>
        }

        @if (editOpen() && isOwner()) {
          <section class="panel album-edit-panel">
            <span class="panel-label">Configuracion del album</span>
            <form class="album-form" (submit)="saveAlbum($event)">
              <label>
                <span>Titulo</span>
                <input
                  type="text"
                  maxlength="160"
                  required
                  [value]="editTitle()"
                  (input)="editTitle.set($any($event.target).value)"
                />
              </label>

              <label>
                <span>Descripcion</span>
                <textarea
                  maxlength="2000"
                  [value]="editDescription()"
                  (input)="editDescription.set($any($event.target).value)"
                ></textarea>
              </label>

              <label>
                <span>Visibilidad</span>
                <select
                  [value]="editVisibility()"
                  (change)="setEditVisibility($any($event.target).value)"
                >
                  <option value="private">Privado</option>
                  <option value="public">Publico</option>
                </select>
              </label>

              <button
                class="button primary"
                type="submit"
                [disabled]="savingAlbum() || !editTitle().trim()"
              >
                {{ savingAlbum() ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            </form>
          </section>
        }

        <section class="panel assets-panel" aria-label="Recuerdos del album">
          <div class="panel-title-row">
            <div>
              <span class="panel-label">Recuerdos</span>
              <h2>Fotos y videos</h2>
              <p>
                Guardados en tu Google Drive, nunca publicos por enlace.
                El album sigue siendo {{ current.visibility === 'public' ? 'publico' : 'privado' }}.
              </p>
            </div>
            <button
              class="button ghost"
              type="button"
              [disabled]="assetsLoading() || uploading()"
              (click)="loadAssets()"
            >
              {{ assetsLoading() ? 'Cargando…' : 'Actualizar' }}
            </button>
          </div>

          <p class="offline-note">
            Sin conexion no se suben ni se cargan fotos nuevas; lo ya visto
            puede seguir disponible en la cache de la app.
          </p>

          @if (canUpload()) {
            <div class="upload-block">
              @if (readyConnections().length > 1) {
                <label class="drive-select">
                  <span>Guardar en</span>
                  <select
                    [value]="selectedConnectionId() ?? ''"
                    [disabled]="uploading()"
                    (change)="selectConnection($any($event.target).value)"
                  >
                    @for (connection of readyConnections(); track connection.id) {
                      <option [value]="connection.id">
                        {{ connection.displayName || 'Google Drive' }}
                      </option>
                    }
                  </select>
                </label>
              } @else if (readyConnections().length === 1) {
                <p class="quiet-status">
                  Se guardara en {{ readyConnections()[0].displayName || 'Google Drive' }}.
                </p>
              } @else {
                <div class="notice warning">
                  Conecta y prepara Google Drive antes de subir.
                  <a class="inline-link" routerLink="/settings/storage">Abrir almacenamiento</a>
                </div>
              }

              <label class="upload-label">
                <span>Subir foto o video (jpeg, png, webp o mp4, maximo {{ maxUploadMb() }} MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  [disabled]="!selectedConnectionId() || uploading()"
                  (change)="onFileSelected($event)"
                />
              </label>

              @if (uploading()) {
                <div role="status" aria-live="polite" class="upload-progress">
                  <progress [value]="uploadProgress()" max="100"></progress>
                  <span>Subiendo… {{ uploadProgress() }}%</span>
                </div>
              }
              @if (uploadSuccess()) {
                <div class="notice success">{{ uploadSuccess() }}</div>
              }
              @if (uploadError()) {
                <div class="notice error">{{ uploadError() }}</div>
              }
            </div>
          }

          @if (assetsLoading()) {
            <div class="loading-panel">
              <div class="loader"></div>
              <span>Cargando recuerdos…</span>
            </div>
          } @else if (assetsError()) {
            <div class="notice error">
              {{ assetsError() }}
              <div class="button-row">
                <button class="button ghost" type="button" (click)="loadAssets()">
                  Reintentar
                </button>
              </div>
            </div>
          } @else if (assets().length === 0) {
            <p class="empty-state">
              Este album aun no tiene fotos ni videos.
              @if (canUpload()) {
                Sube el primero desde tu Google Drive.
              }
            </p>
          } @else {
            <div class="asset-grid" aria-label="Galeria del album">
              @for (asset of assets(); track asset.id) {
                @if (asset.mimeType === 'video/mp4') {
                  <button
                    class="asset-thumb"
                    type="button"
                    [title]="assetTitle(asset)"
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
                    [title]="assetTitle(asset)"
                    [attr.aria-label]="'Ver foto ' + asset.originalName"
                    (click)="openAsset(asset)"
                  >
                    <img [src]="contentUrl(asset)" [alt]="asset.originalName" loading="lazy" />
                  </button>
                }
              }
            </div>
          }

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
                @if (current.mimeType === 'video/mp4') {
                  <video [src]="contentUrl(current)" controls preload="metadata" playsinline></video>
                } @else {
                  <img [src]="contentUrl(current)" [alt]="current.originalName" />
                }
                <div class="button-row asset-dialog-actions">
                  <button class="button ghost" type="button" (click)="closeAsset()">
                    Cerrar
                  </button>
                  @if (canDeleteAsset(current)) {
                    <button
                      class="mini-button danger"
                      type="button"
                      [disabled]="deleting()"
                      (click)="deleteAsset(current)"
                    >
                      {{ deleting() ? 'Eliminando…' : 'Eliminar' }}
                    </button>
                  }
                </div>
                @if (deleteError()) {
                  <div class="notice error">{{ deleteError() }}</div>
                }
              </div>
            </div>
          }
        </section>

        <section class="album-workspace-grid">
          <article class="panel members-panel">
            <div class="panel-title-row">
              <div>
                <span class="panel-label">Personas</span>
                <h2>Miembros</h2>
              </div>
              @if (membersBusy()) {
                <span class="quiet-status">Actualizando…</span>
              }
            </div>

            @if (membersError()) {
              <div class="notice warning">{{ membersError() }}</div>
            } @else if (members().length === 0) {
              <p class="empty-state">
                El listado de miembros no esta disponible para esta vista.
              </p>
            } @else {
              <div class="member-list">
                @for (member of members(); track member.userId) {
                  <div class="member-row">
                    <div class="member-avatar" aria-hidden="true">
                      {{ initial(member.email) }}
                    </div>
                    <div class="member-copy">
                      <strong>{{ member.email }}</strong>
                      <small>
                        {{ member.role === 'owner' ? 'Propietario' : 'Miembro' }} ·
                        {{ membershipLabel(member.status) }}
                      </small>
                    </div>
                    @if (isOwner() && member.role !== 'owner' && member.status !== 'removed') {
                      <button
                        class="mini-button danger"
                        type="button"
                        [disabled]="membersBusy()"
                        (click)="removeMember(member.userId)"
                      >
                        Quitar
                      </button>
                    }
                  </div>
                }
              </div>
            }

            @if (isOwner()) {
              <form class="invite-form" (submit)="invite($event)">
                <label>
                  <span>Invitar una cuenta iRec verificada</span>
                  <input
                    type="email"
                    required
                    [value]="inviteEmail()"
                    (input)="inviteEmail.set($any($event.target).value)"
                    placeholder="persona@correo.com"
                  />
                </label>
                <button
                  class="button ghost"
                  type="submit"
                  [disabled]="membersBusy() || !inviteEmail().trim()"
                >
                  Invitar
                </button>
              </form>

              @if (inviteMessage()) {
                <div class="notice success invite-result">
                  <strong>{{ inviteMessage() }}</strong>
                  <span>
                    La persona debe abrir el enlace con la cuenta invitada y aceptar.
                  </span>
                  <div class="invite-link-row">
                    <code>{{ invitationUrl() }}</code>
                    <button class="mini-button" type="button" (click)="copyInvitation()">
                      {{ invitationCopied() ? 'Copiado' : 'Copiar enlace' }}
                    </button>
                  </div>
                </div>
              }
            }
          </article>

          <article class="panel collaboration-panel">
            @if (isOwner()) {
              <div class="panel-title-row">
                <div>
                  <span class="panel-label">Moderacion</span>
                  <h2>Propuestas</h2>
                </div>
                <span class="proposal-count">{{ pendingCount() }} pendientes</span>
              </div>

              @if (proposalsBusy()) {
                <div class="loader"></div>
              } @else if (proposalsError()) {
                <div class="notice error">{{ proposalsError() }}</div>
              } @else if (proposals().length === 0) {
                <p class="empty-state">Todavia no hay propuestas para revisar.</p>
              } @else {
                <div class="proposal-list">
                  @for (proposal of proposals(); track proposal.id) {
                    <div class="proposal-row" [class.decided]="proposal.status !== 'pending'">
                      <div class="proposal-head">
                        <strong>{{ proposal.proposerEmail }}</strong>
                        <span class="proposal-status" [attr.data-status]="proposal.status">
                          {{ proposalStatusLabel(proposal.status) }}
                        </span>
                      </div>
                      <p>{{ proposal.text }}</p>
                      <small>Enviada {{ formatDateTime(proposal.createdAt) }}</small>

                      @if (proposal.status === 'pending') {
                        <div class="proposal-actions">
                          <button
                            class="mini-button approve"
                            type="button"
                            [disabled]="moderatingId() === proposal.id"
                            (click)="moderate(proposal.id, 'approve')"
                          >
                            Aprobar
                          </button>
                          <button
                            class="mini-button danger"
                            type="button"
                            [disabled]="moderatingId() === proposal.id"
                            (click)="moderate(proposal.id, 'reject')"
                          >
                            Rechazar
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            } @else if (canPropose()) {
              <span class="panel-label">Colaboracion</span>
              <h2>Propone algo para el album</h2>
              <p>
                En v0.4 la propuesta sigue siendo texto. Las fotos y videos del
                album se suben en la seccion Recuerdos con tu Google Drive.
              </p>

              <form class="proposal-form" (submit)="createProposal($event)">
                <label>
                  <span>Propuesta</span>
                  <textarea
                    maxlength="2000"
                    required
                    [value]="proposalText()"
                    (input)="proposalText.set($any($event.target).value)"
                    placeholder="Cuenta que contenido te gustaria agregar…"
                  ></textarea>
                </label>

                @if (proposalMessage()) {
                  <div class="notice success">{{ proposalMessage() }}</div>
                }
                @if (proposalSubmitError()) {
                  <div class="notice error">{{ proposalSubmitError() }}</div>
                }

                <button
                  class="button primary"
                  type="submit"
                  [disabled]="proposalBusy() || !proposalText().trim()"
                >
                  {{ proposalBusy() ? 'Enviando…' : 'Enviar propuesta' }}
                </button>
              </form>
            } @else {
              <span class="panel-label">Album</span>
              <h2>Vista de lectura</h2>
              <p>
                Esta sesion puede ver el album, pero no tiene permisos de colaboracion.
              </p>
            }
          </article>
        </section>
      }
    </main>
  `,
})
export class AlbumDetailPage implements OnInit {
  private readonly api = inject(AlbumApiService);
  private readonly storage = inject(StorageApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthStore);

  readonly album = signal<AlbumContract | null>(null);
  readonly members = signal<readonly AlbumMemberViewContract[]>([]);
  readonly proposals = signal<readonly AlbumProposalViewContract[]>([]);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly membersBusy = signal(false);
  readonly membersError = signal('');
  readonly proposalsBusy = signal(false);
  readonly proposalsError = signal('');

  readonly editOpen = signal(false);
  readonly savingAlbum = signal(false);
  readonly editTitle = signal('');
  readonly editDescription = signal('');
  readonly editVisibility = signal<AlbumVisibility>('private');

  readonly inviteEmail = signal('');
  readonly inviteMessage = signal('');
  readonly invitationCopied = signal(false);
  readonly publicLinkCopied = signal(false);

  readonly proposalText = signal('');
  readonly proposalBusy = signal(false);
  readonly proposalMessage = signal('');
  readonly proposalSubmitError = signal('');
  readonly moderatingId = signal<string | null>(null);

  readonly assets = signal<readonly AlbumAssetContract[]>([]);
  readonly assetsLoading = signal(false);
  readonly assetsError = signal('');
  readonly readyConnections = signal<readonly StorageConnectionContract[]>([]);
  readonly selectedConnectionId = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  readonly activeAsset = signal<AlbumAssetContract | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal('');

  private readonly albumId = this.route.snapshot.paramMap.get('albumId') ?? '';

  readonly isOwner = computed(
    () => this.album()?.ownerId === this.auth.user()?.id,
  );

  readonly myMembership = computed(() => {
    const userId = this.auth.user()?.id;
    return userId
      ? this.members().find((member) => member.userId === userId) ?? null
      : null;
  });

  readonly canPropose = computed(
    () => !this.isOwner() && this.myMembership()?.status === 'active',
  );

  readonly canUpload = computed(
    () => this.isOwner() || this.myMembership()?.status === 'active',
  );

  readonly pendingCount = computed(
    () => this.proposals().filter((proposal) => proposal.status === 'pending').length,
  );

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (!this.albumId) {
      this.error.set('El album no tiene un identificador valido.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const album = await firstValueFrom(this.api.get(this.albumId));
      this.album.set(album);
      this.syncEdit(album);
      await this.loadMembers();
      if (album.ownerId === this.auth.user()?.id) {
        await this.loadProposals();
      }
      await this.loadAssets();
      if (this.canUpload()) {
        await this.loadUploadConnections();
      }
    } catch (error) {
      this.error.set(uiError(error, 'No pudimos abrir este album.'));
    } finally {
      this.loading.set(false);
    }
  }

  toggleEdit(): void {
    if (!this.isOwner()) return;
    this.editOpen.update((value) => !value);
    const album = this.album();
    if (album) this.syncEdit(album);
  }

  setEditVisibility(value: string): void {
    this.editVisibility.set(value === 'public' ? 'public' : 'private');
  }

  async saveAlbum(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.isOwner() || this.savingAlbum() || !this.editTitle().trim()) return;

    this.savingAlbum.set(true);
    this.error.set('');

    try {
      const album = await firstValueFrom(
        this.api.update(this.albumId, {
          title: this.editTitle().trim(),
          description: this.editDescription().trim() || null,
          visibility: this.editVisibility(),
        }),
      );
      this.album.set(album);
      this.syncEdit(album);
      this.editOpen.set(false);
    } catch (error) {
      this.error.set(uiError(error, 'No pudimos guardar los cambios.'));
    } finally {
      this.savingAlbum.set(false);
    }
  }

  async loadMembers(): Promise<void> {
    this.membersBusy.set(true);
    this.membersError.set('');

    try {
      const result = await firstValueFrom(this.api.members(this.albumId));
      this.members.set(result.members);
    } catch (error) {
      this.members.set([]);
      this.membersError.set(
        uiError(error, 'El listado de miembros no esta disponible para esta sesion.'),
      );
    } finally {
      this.membersBusy.set(false);
    }
  }

  async invite(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.inviteEmail().trim().toLowerCase();
    if (!this.isOwner() || !email || this.membersBusy()) return;

    this.membersBusy.set(true);
    this.membersError.set('');
    this.inviteMessage.set('');

    try {
      const member = await firstValueFrom(this.api.invite(this.albumId, { email }));
      this.inviteMessage.set(`Invitacion preparada para ${member.email}.`);
      this.inviteEmail.set('');
      await this.loadMembers();
    } catch (error) {
      this.membersError.set(uiError(error, 'No pudimos invitar esa cuenta.'));
      this.membersBusy.set(false);
    }
  }

  invitationUrl(): string {
    if (typeof window === 'undefined') return `/albums/${this.albumId}/join`;
    return `${window.location.origin}/albums/${this.albumId}/join`;
  }

  async copyInvitation(): Promise<void> {
    await navigator.clipboard.writeText(this.invitationUrl());
    this.invitationCopied.set(true);
    window.setTimeout(() => this.invitationCopied.set(false), 1600);
  }

  publicAlbumUrl(): string {
    if (typeof window === 'undefined') return `/a/${this.albumId}`;
    return `${window.location.origin}/a/${this.albumId}`;
  }

  async copyPublicLink(): Promise<void> {
    await navigator.clipboard.writeText(this.publicAlbumUrl());
    this.publicLinkCopied.set(true);
    window.setTimeout(() => this.publicLinkCopied.set(false), 1600);
  }

  async removeMember(userId: string): Promise<void> {
    if (!this.isOwner() || this.membersBusy()) return;
    this.membersBusy.set(true);
    this.membersError.set('');

    try {
      await firstValueFrom(this.api.removeMember(this.albumId, userId));
      await this.loadMembers();
    } catch (error) {
      this.membersError.set(uiError(error, 'No pudimos quitar a este miembro.'));
      this.membersBusy.set(false);
    }
  }

  async loadProposals(): Promise<void> {
    if (!this.isOwner()) return;
    this.proposalsBusy.set(true);
    this.proposalsError.set('');

    try {
      const result = await firstValueFrom(this.api.proposals(this.albumId));
      this.proposals.set(result.proposals);
    } catch (error) {
      this.proposalsError.set(uiError(error, 'No pudimos cargar las propuestas.'));
    } finally {
      this.proposalsBusy.set(false);
    }
  }

  async createProposal(event: Event): Promise<void> {
    event.preventDefault();
    const text = this.proposalText().trim();
    if (!this.canPropose() || !text || this.proposalBusy()) return;

    this.proposalBusy.set(true);
    this.proposalMessage.set('');
    this.proposalSubmitError.set('');

    try {
      await firstValueFrom(this.api.createProposal(this.albumId, { text }));
      this.proposalText.set('');
      this.proposalMessage.set('Propuesta enviada. El propietario podra aprobarla o rechazarla.');
    } catch (error) {
      this.proposalSubmitError.set(uiError(error, 'No pudimos enviar la propuesta.'));
    } finally {
      this.proposalBusy.set(false);
    }
  }

  async moderate(
    proposalId: string,
    action: 'approve' | 'reject',
  ): Promise<void> {
    if (!this.isOwner() || this.moderatingId()) return;
    this.moderatingId.set(proposalId);
    this.proposalsError.set('');

    try {
      const updated = await firstValueFrom(
        action === 'approve'
          ? this.api.approveProposal(this.albumId, proposalId)
          : this.api.rejectProposal(this.albumId, proposalId),
      );
      this.proposals.update((items) =>
        items.map((proposal) => (proposal.id === updated.id ? updated : proposal)),
      );
    } catch (error) {
      this.proposalsError.set(uiError(error, 'No pudimos moderar la propuesta.'));
    } finally {
      this.moderatingId.set(null);
    }
  }

  async loadAssets(): Promise<void> {
    if (!this.albumId) return;
    this.assetsLoading.set(true);
    this.assetsError.set('');
    try {
      const result = await firstValueFrom(this.api.listAssets(this.albumId));
      this.assets.set(result.assets);
      const active = this.activeAsset();
      if (active && !result.assets.some((asset) => asset.id === active.id)) {
        this.activeAsset.set(null);
      }
    } catch (error) {
      this.assetsError.set(uiError(error, 'No pudimos cargar las fotos y videos.'));
    } finally {
      this.assetsLoading.set(false);
    }
  }

  async loadUploadConnections(): Promise<void> {
    try {
      const result = await firstValueFrom(this.storage.list());
      const ready = result.connections.filter((connection) => connection.status === 'ready');
      this.readyConnections.set(ready);
      const preferred = this.readPreferredConnection();
      this.selectedConnectionId.set(
        preferred && ready.some((connection) => connection.id === preferred)
          ? preferred
          : (ready[0]?.id ?? null),
      );
    } catch {
      this.readyConnections.set([]);
      this.selectedConnectionId.set(null);
    }
  }

  selectConnection(connectionId: string): void {
    if (this.uploading()) return;
    this.selectedConnectionId.set(connectionId || null);
    if (connectionId) this.writePreferredConnection(connectionId);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || this.uploading()) return;
    this.uploadSuccess.set('');
    const connectionId = this.selectedConnectionId();
    if (!connectionId) {
      this.uploadError.set('Elige una conexion de Google Drive antes de subir.');
      return;
    }
    if (file.type && !ALLOWED_UPLOAD_MIME.includes(file.type)) {
      this.uploadError.set('Tipo de archivo no permitido: solo jpeg, png, webp o mp4.');
      return;
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      this.uploadError.set('El archivo no es valido.');
      return;
    }
    if (file.size > MAX_ALBUM_ASSET_SIZE_BYTES) {
      this.uploadError.set(`El archivo supera el limite de ${this.maxUploadMb()} MB.`);
      return;
    }
    this.uploadError.set('');
    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.api.uploadAsset(this.albumId, {
      storageConnectionId: connectionId,
      sizeBytes: file.size,
      file,
    }).subscribe({
      next: (httpEvent) => {
        if (httpEvent.type === HttpEventType.UploadProgress) {
          const total = httpEvent.total ?? file.size;
          this.uploadProgress.set(total > 0 ? Math.min(100, Math.round((100 * httpEvent.loaded) / total)) : 0);
        } else if (httpEvent.type === HttpEventType.Response) {
          this.uploading.set(false);
          this.uploadProgress.set(100);
          this.uploadSuccess.set('Recuerdo guardado en tu Google Drive.');
          if (input) input.value = '';
          void this.loadAssets();
        }
      },
      error: (error: unknown) => {
        this.uploading.set(false);
        this.uploadError.set(uiError(error, 'No pudimos subir el archivo.'));
        if (input) input.value = '';
      },
    });
  }

  openAsset(asset: AlbumAssetContract): void {
    this.deleteError.set('');
    this.activeAsset.set(asset);
  }

  closeAsset(): void {
    if (this.deleting()) return;
    this.activeAsset.set(null);
  }

  async deleteAsset(asset: AlbumAssetContract): Promise<void> {
    if (this.deleting() || !this.canDeleteAsset(asset)) return;
    if (typeof window !== 'undefined' && !window.confirm('¿Eliminar este recuerdo? Tambien se borra de Google Drive.')) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set('');
    try {
      await firstValueFrom(this.api.deleteAsset(this.albumId, asset.id));
      if (this.activeAsset()?.id === asset.id) this.activeAsset.set(null);
      await this.loadAssets();
    } catch (error) {
      this.deleteError.set(uiError(error, 'No pudimos eliminar el recuerdo.'));
    } finally {
      this.deleting.set(false);
    }
  }

  canDeleteAsset(asset: AlbumAssetContract): boolean {
    if (this.isOwner()) return true;
    return asset.uploadedBy === this.auth.user()?.id && this.myMembership()?.status === 'active';
  }

  contentUrl(asset: AlbumAssetContract): string {
    return this.api.contentUrl(this.albumId, asset.id);
  }

  assetTitle(asset: AlbumAssetContract): string {
    return `${asset.originalName} · Conexion ${asset.storageConnectionId}`;
  }

  maxUploadMb(): number {
    return Math.round(MAX_ALBUM_ASSET_SIZE_BYTES / 1024 / 1024);
  }

  private readPreferredConnection(): string | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(PREFERRED_CONNECTION_KEY);
    } catch {
      return null;
    }
  }

  private writePreferredConnection(connectionId: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(PREFERRED_CONNECTION_KEY, connectionId);
    } catch {
      // Private mode or unavailable storage: the selector still works for this session.
    }
  }

  initial(email: string): string {
    return email.trim().charAt(0).toUpperCase() || '?';
  }

  membershipLabel(status: AlbumMemberViewContract['status']): string {
    if (status === 'active') return 'Activo';
    if (status === 'invited') return 'Invitado';
    return 'Removido';
  }

  proposalStatusLabel(status: AlbumProposalViewContract['status']): string {
    if (status === 'approved') return 'Aprobada';
    if (status === 'rejected') return 'Rechazada';
    return 'Pendiente';
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private syncEdit(album: AlbumContract): void {
    this.editTitle.set(album.title);
    this.editDescription.set(album.description ?? '');
    this.editVisibility.set(album.visibility);
  }
}
