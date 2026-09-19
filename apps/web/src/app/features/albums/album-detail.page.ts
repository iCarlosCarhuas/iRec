import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  AlbumContract,
  AlbumMemberViewContract,
  AlbumProposalViewContract,
  AlbumVisibility,
} from '@irec/contracts';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '../../core/auth/auth-store.service';
import { uiError } from '../../core/http/ui-error';
import { AlbumApiService } from './album-api.service';

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

          @if (isOwner()) {
            <button class="button ghost" type="button" (click)="toggleEdit()">
              {{ editOpen() ? 'Cerrar edicion' : 'Editar album' }}
            </button>
          }
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
                En v0.3 la propuesta es texto. Cuando llegue Photos/R2, este mismo
                flujo servira para contenido multimedia.
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

  readonly proposalText = signal('');
  readonly proposalBusy = signal(false);
  readonly proposalMessage = signal('');
  readonly proposalSubmitError = signal('');
  readonly moderatingId = signal<string | null>(null);

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
