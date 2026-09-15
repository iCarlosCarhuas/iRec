# Estado actual del proyecto iRec

**Fecha de corte:** 2026-09-15  
**Release estable:** `v0.1.0`  
**Release en construcción:** `v0.2.0 — Identity`

Este documento es el punto de reentrada cuando se retoma el proyecto.

## Git / worktrees

```text
E:\MVP\iRec
└─ main
   └─ v0.1.0 estable

E:\MVP\iRec-worktrees\backend
└─ feat/backend
   └─ v0.2.0 Identity backend validado

E:\MVP\iRec-worktrees\frontend
└─ feat/frontend
   └─ v0.2.0 Identity frontend validado

E:\MVP\iRec-worktrees\docs
└─ docs/project
   └─ documentación v0.2.0 sincronizada
```

No hacer desarrollo de feature directamente sobre `main`.

## v0.2.0 — estado por gate

| Gate | Estado |
|---|---|
| Backend Identity | ✅ PASSED |
| Frontend Identity | ✅ PASSED |
| TOTP onboarding | ✅ PASSED |
| HyperFrames QA | ✅ PASSED |
| E2E funcional Identity | ⏳ Pendiente |
| Integración a `main` | ⏳ Pendiente |
| Tag `v0.2.0` | ⏳ Pendiente |

## Backend validado

Resultado:

```text
iRec v0.2.0 IDENTITY BACKEND PASSED
```

Incluye:

- PostgreSQL + Drizzle;
- Redis;
- Mailpit;
- JWT RS256;
- refresh rotativo;
- reuse detection;
- TOTP;
- recovery codes;
- trusted devices;
- OpenAPI 3.1;
- Scalar;
- migraciones versionadas.

## Frontend validado

Resultado:

```text
iRec v0.2.0 IDENTITY FRONTEND PASSED
```

Validó:

- `@irec/contracts` build/typecheck;
- Angular typecheck;
- Angular production build;
- rutas Identity;
- proxy `/api`;
- smoke contra backend real;
- `/auth`;
- `/auth/recover`;
- `/settings/security`;
- `/api/health/live` vía proxy.

## UX Identity implementada

```text
/
├─ /auth
├─ /auth/verify-email
├─ /auth/totp/setup
├─ /auth/recovery-codes
├─ /auth/recover
└─ /settings/security
```

Incluye:

- alta por email;
- login email + TOTP;
- remember device;
- recuperación por email;
- recuperación por recovery code;
- trusted devices;
- revocación;
- rotación TOTP;
- recovery codes copiar/descargar.

## TOTP onboarding

La pantalla:

```text
/auth/totp/setup
```

incluye ahora:

- guía paso a paso;
- Google Authenticator como camino principal;
- Microsoft Authenticator como alternativa;
- QR / clave manual;
- explicación del código de 6 dígitos;
- continuidad hasta `Activar TOTP`;
- recordatorio de recovery codes.

## HyperFrames

El tutorial se reproduce dentro de la misma ruta:

```text
/auth/totp/setup
```

y no abre una ruta de producto separada.

QA validado:

```text
Runtime   OK
Layout    OK
Motion    OK
Contrast  73/73 WCAG AA
```

Resultado:

```text
[OK] iRec TOTP HyperFrames QA PASSED
```

La advertencia `timeline_track_too_dense` queda aceptada por ahora como
mantenibilidad, no como error de runtime/render/accesibilidad.

## Infraestructura local

```text
irec-infra
├─ irec-postgres
├─ irec-redis
├─ irec-mailpit
└─ irec-network
```

PostgreSQL host:

```text
127.0.0.1:15432
```

## Próximo gate

Ahora corresponde el E2E funcional real:

```text
registro
→ email verify
→ TOTP setup
→ activar TOTP
→ recovery codes
→ logout
→ login
→ remember device
→ session restore
→ trusted devices
→ recovery
→ TOTP rotation
→ invalidar TOTP anterior
```

## Regla

No avanzar a `v0.3.0 — Album Core` hasta cerrar:

1. E2E Identity;
2. integración a `main`;
3. gate final;
4. tag/release `v0.2.0`.
