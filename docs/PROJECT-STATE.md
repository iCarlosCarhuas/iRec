# Estado actual del proyecto iRec

**Fecha de corte:** 2026-09-16  
**Release estable:** `v0.1.0 — Foundation`  
**Release en construcción:** `v0.2.0 — Identity`

Este documento es el punto de reentrada operativo.

## 1. Qué representa cada rama hoy

```text
main
└─ v0.1.0 Foundation estable

feat/backend
└─ v0.2.0 Identity backend validado

feat/frontend
└─ v0.2.0 Identity frontend validado

docs/project
└─ documentación v0.2.0 sincronizada
```

Las tres ramas de trabajo están intencionalmente fuera de `main`. Ninguna de
ellas contiene por sí sola el candidato completo de `v0.2.0`.

## 2. Worktrees actuales

```text
E:\MVP\iRec
└─ main

E:\MVP\iRec-worktrees\backend
└─ feat/backend

E:\MVP\iRec-worktrees\frontend
└─ feat/frontend

E:\MVP\iRec-worktrees\docs
└─ docs/project
```

## 3. Próximo worktree

Se crea antes del E2E final:

```text
E:\MVP\iRec-worktrees\v0.2.0
└─ integration/v0.2.0
```

Su función es producir el primer árbol que contenga simultáneamente backend,
frontend y documentación de `v0.2.0` sin alterar `main`.

## 4. Estado por gate

| Gate | Estado |
|---|---|
| Foundation `v0.1.0` | ✅ RELEASED |
| Backend Identity | ✅ PASSED |
| Frontend Identity | ✅ PASSED |
| TOTP onboarding | ✅ PASSED |
| HyperFrames QA | ✅ PASSED |
| Crear `integration/v0.2.0` | ⏳ Pendiente |
| Full-stack Docker | ⏳ Pendiente |
| E2E funcional Identity | ⏳ Pendiente |
| Gate final integrado | ⏳ Pendiente |
| Merge a `main` | ⏳ Pendiente |
| Tag `v0.2.0` | ⏳ Pendiente |

## 5. Backend validado

`feat/backend` contiene, entre otros:

- NestJS Identity;
- PostgreSQL 17 + Drizzle ORM;
- migraciones SQL versionadas;
- Redis;
- Mailpit;
- JWT RS256;
- refresh token opaco rotativo;
- reuse detection;
- TOTP;
- recovery codes;
- trusted devices;
- OpenAPI 3.1;
- Scalar;
- naming `irec-*`;
- PostgreSQL host `15432`;
- scripts de diagnóstico, bootstrap de `.env` y gate backend.

Resultado registrado:

```text
iRec v0.2.0 IDENTITY BACKEND PASSED
OpenAPI 3.1 — 18 paths
```

## 6. Frontend validado

`feat/frontend` contiene:

```text
/
/auth
/auth/verify-email
/auth/totp/setup
/auth/recovery-codes
/auth/recover
/settings/security
```

Incluye:

- sesión restaurable con cookies HttpOnly;
- email + TOTP;
- recovery por correo y recovery code;
- trusted devices;
- revocación;
- rotación de TOTP;
- recovery codes;
- proxy `/api -> 127.0.0.1:3000`;
- onboarding TOTP;
- tutorial HyperFrames inline.

Resultado registrado:

```text
iRec v0.2.0 IDENTITY FRONTEND PASSED
HyperFrames: 73/73 contrast checks WCAG AA
```

## 7. Aislamiento esperado entre ramas

Es normal encontrar archivos aparentemente “viejos” en un worktree de otra
responsabilidad. Por ejemplo, `feat/frontend` no incorpora todavía la nueva
infraestructura Docker de `feat/backend`, y `docs/project` no debe usarse como
árbol ejecutable completo.

Eso no se corrige copiando carpetas entre worktrees. Se resuelve mediante Git
merge en `integration/v0.2.0`.

## 8. Estrategia de ejecución

### Modo A — desarrollo híbrido actual

```text
Docker     → PostgreSQL + Redis + Mailpit
Host       → NestJS API
Host       → Angular dev server
```

### Modo B — candidato/release local

Objetivo de `integration/v0.2.0`:

```text
docker compose up --build -d
```

para levantar:

```text
irec-web
irec-api
irec-migrate
irec-postgres
irec-redis
irec-mailpit
```

El full-stack Docker todavía es un gate pendiente; no se documenta como
implementado hasta que exista y sea probado.

## 9. Próxima secuencia

```text
crear integration/v0.2.0
        ↓
merge feat/backend
        ↓
merge feat/frontend
        ↓
merge docs/project
        ↓
resolver/validar integración
        ↓
implementar full-stack Docker
        ↓
Docker smoke gate
        ↓
E2E Identity
        ↓
gate final
        ↓
PR/merge a main
        ↓
tag v0.2.0
```

## 10. Regla

No avanzar a `v0.3.0 — Album Core` hasta cerrar `v0.2.0` en `main` y publicar
el tag correspondiente.
