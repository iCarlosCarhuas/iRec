# Estado actual del proyecto iRec

**Fecha de corte:** 2026-09-15  
**Release estable:** `v0.1.0`  
**Release en construcción:** `v0.2.0 — Identity`

Este documento es el punto de reentrada cuando se retoma el proyecto después
de una pausa. Describe qué está realmente validado y qué sigue pendiente.

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
   └─ Identity frontend pendiente

E:\MVP\iRec-worktrees\docs
└─ docs/project
   └─ documentación v0.2.0 en sincronización
```

No hacer desarrollo de feature directamente sobre `main`.

## Gate backend v0.2.0

El gate real pasó con:

```text
iRec v0.2.0 IDENTITY BACKEND PASSED
```

Validó:

- `pnpm install`;
- `irec-infra` healthy;
- PostgreSQL;
- Redis;
- Mailpit;
- cinco tablas de Identity;
- TypeScript de web/contracts/api;
- OpenAPI 3.1;
- 18 paths;
- Angular build;
- NestJS build;
- generación de migraciones;
- aplicación idempotente de migraciones;
- health/OpenAPI/Scalar/Mailpit smoke checks.

## Infraestructura local validada

```text
irec-infra
├─ irec-postgres
├─ irec-redis
├─ irec-mailpit
└─ irec-network
```

Persistencia:

```text
irec-postgres-data
irec-redis-data
```

Puertos:

| Servicio | Host | Contenedor |
|---|---:|---:|
| PostgreSQL | `15432` | `5432` |
| Redis | `6379` | `6379` |
| Mailpit SMTP | `1025` | `1025` |
| Mailpit UI | `8025` | `8025` |
| API | `3000` | — |
| Angular | `4200` | — |

PostgreSQL usa `15432` en host para evitar colisiones con instalaciones locales.

## Esquema Identity existente

PostgreSQL contiene:

```text
users
email_tokens
totp_credentials
recovery_codes
trusted_devices
```

Las migraciones están versionadas bajo:

```text
apps/api/drizzle/
```

`drizzle-kit push` dejó de ser el flujo oficial.

## Seguridad vigente

```text
email verificado + TOTP
        ↓
JWT RS256 access (15 min)
        ↓
cookie HttpOnly

refresh opaco (12 h)
        ↓
rotación por uso
        ↓
Redis refresh family + reuse detection
```

Además:

- trusted device: hasta 30 días;
- TOTP: SHA-1, 6 dígitos, 30 s, tolerancia ±1 timestep;
- replay protection por `lastTimeStep`;
- recovery codes: 10, un solo uso, hash bcrypt cost 12;
- TOTP secret: AES-256-GCM;
- email/auth-flow tokens: alta entropía y corta vida;
- cookies: HttpOnly, SameSite=Lax, Secure en producción;
- anti-enumeración y rate limiting en auth.

## API Identity

Identity aporta 16 rutas `/auth/*`.
Con los dos health checks, OpenAPI valida **18 paths**.

Referencia:

```text
http://localhost:3000/openapi.json
http://localhost:3000/reference
```

Mailpit:

```text
http://localhost:8025
```

## Próximo trabajo

1. cerrar commit/push de `feat/backend`;
2. implementar Identity UI en `feat/frontend`;
3. conectar frontend a contratos reales;
4. ejecutar E2E obligatorio;
5. actualizar documentación con evidencia frontend/E2E;
6. integrar `feat/backend`, `feat/frontend` y `docs/project` a `main`;
7. ejecutar gate completo desde `main`;
8. crear tag/release `v0.2.0`.

## No avanzar todavía a v0.3.0

`Album Core` comienza únicamente después de cerrar `v0.2.0` como release.
