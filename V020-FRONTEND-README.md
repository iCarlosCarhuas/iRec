# iRec v0.2.0 — Identity frontend

Aplicar sobre:

```text
E:\MVP\iRec-worktrees\frontend
```

## Incluye

- `/`
- `/auth`
- `/auth/verify-email`
- `/auth/totp/setup`
- `/auth/recovery-codes`
- `/auth/recover`
- `/settings/security`
- sesión con cookies HttpOnly;
- trusted devices;
- recovery por email/código;
- rotación TOTP;
- proxy local `/api -> 127.0.0.1:3000`;
- contratos Identity `@irec/contracts`;
- gate de build/typecheck/smoke.

## Regla de seguridad

El frontend no guarda access JWT, refresh token, TOTP secret ni recovery codes
en `localStorage` o `sessionStorage`.

Los recovery codes solo permanecen en memoria durante la pantalla que sigue a
la activación/rotación y pueden copiarse o descargarse explícitamente.

## Backend requerido

Antes del smoke frontend, debe estar ejecutándose el backend validado de
`feat/backend`:

```text
http://127.0.0.1:3000/api/health/live
```

## Ejecutar

```bash
cd /e/MVP/iRec-worktrees/frontend
pnpm install
pnpm --filter @irec/contracts build
powershell.exe -ExecutionPolicy Bypass -File ./scripts/verify-identity-frontend.ps1
```

Cuando el gate pase, se prepara el E2E Identity real.
