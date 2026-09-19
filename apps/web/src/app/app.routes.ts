import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.page').then((m) => m.HomePage),
    title: 'iRec',
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth.page').then((m) => m.AuthPage),
    title: 'Ingresar · iRec',
  },
  {
    path: 'auth/verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email.page').then(
        (m) => m.VerifyEmailPage,
      ),
    title: 'Verificar correo · iRec',
  },
  {
    path: 'auth/totp/setup',
    loadComponent: () =>
      import('./features/auth/totp-setup.page').then((m) => m.TotpSetupPage),
    title: 'Configurar autenticador · iRec',
  },
  {
    path: 'auth/recovery-codes',
    loadComponent: () =>
      import('./features/auth/recovery-codes.page').then(
        (m) => m.RecoveryCodesPage,
      ),
    title: 'Codigos de recuperacion · iRec',
  },
  {
    path: 'auth/recover',
    loadComponent: () =>
      import('./features/auth/recover.page').then((m) => m.RecoverPage),
    title: 'Recuperar acceso · iRec',
  },
  {
    path: 'albums',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/albums/albums.page').then((m) => m.AlbumsPage),
    title: 'Mis albumes · iRec',
  },
  {
    path: 'albums/:albumId/join',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/albums/album-join.page').then((m) => m.AlbumJoinPage),
    title: 'Aceptar invitacion · iRec',
  },
  {
    path: 'albums/:albumId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/albums/album-detail.page').then((m) => m.AlbumDetailPage),
    title: 'Album · iRec',
  },
  {
    path: 'settings/security',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/security/security.page').then((m) => m.SecurityPage),
    title: 'Seguridad · iRec',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
