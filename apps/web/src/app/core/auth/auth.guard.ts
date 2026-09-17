import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { AuthStore } from './auth-store.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const session = await store.restore();

  return session.authenticated
    ? true
    : router.createUrlTree(['/auth'], {
        queryParams: { next: state.url },
      });
};
