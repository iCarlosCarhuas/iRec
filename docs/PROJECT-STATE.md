# Estado actual — iRec

**Corte:** 2026-09-25
**Release estable:** `v0.3.0 — Album Core`
**Release objetivo:** `v0.4.0 — R2 + Photos`
**Etapa actual:** `R2-4 — Presigned Photo Upload`

## Estado Git de inicio de v0.4.0

El preflight local confirmó:

```text
main                        -> 20cfbd7
integration/v0.4.0          -> f23b895
feat/v040-photo-domain     -> f23b895
v0.3.0 tag                  -> 0a0767c
```

Worktrees activos para la nueva release:

```text
E:\MVP\iRec
└─ main

E:\MVP\iRec-worktrees\v0.4.0
└─ integration/v0.4.0

E:\MVP\iRec-worktrees\r2-foundation
└─ chore/v040-r2-foundation (R2-0 integrado)

E:\MVP\iRec-worktrees\photo-domain
└─ feat/v040-photo-domain
```

`main` permanece estable. El tag `v0.3.0` no se mueve.

## Releases cerradas

| Release | Alcance | Estado |
|---|---|---|
| `v0.1.0` | Foundation | ✅ RELEASED |
| `v0.2.0` | Identity | ✅ RELEASED |
| `v0.3.0` | Album Core | ✅ RELEASED |

## v0.4.0 — R2 + Photos

Objetivo funcional:

> Permitir que un owner conecte su propio Cloudflare R2 y pueda cargar,
> visualizar y gestionar fotografías dentro de sus álbumes sin convertir a iRec
> en propietario del almacenamiento.

### R2-0 — Foundation ✅

Integrado en `integration/v0.4.0` mediante `f96188c`. Fijó estado, arquitectura,
decisiones y el gate de foundation.

### R2-1 — Storage Connection Domain ✅

Integrado en `integration/v0.4.0` mediante `ca103e2`. Incluye contratos,
`storage_connections`, `albums.storage_connection_id` nullable, cifrado con
`CryptoService`, ownership, migración y Data Safety gate.

### R2-2 — R2 Connection Verification ✅

Integrado en `integration/v0.4.0` mediante `f23b895`. Incluye cliente
S3-compatible, `HeadBucket`, API autenticada para crear/listar/re-testear
conexiones, rate limiting, OpenAPI y tests.

### R2-3 — Photo Asset Domain ✅

Esta iteración introduce:

- enum `album_asset_status`;
- tabla `album_assets`;
- metadata de objeto R2 y thumbnail;
- lifecycle `pending / approved / rejected`;
- owner upload -> `approved`;
- active member upload -> `pending`;
- listado con visibilidad por album/status/uploader;
- moderación owner-only;
- registro de upload como boundary interno, sin endpoint público de creación;
- contratos, OpenAPI, tests y gate.

R2-3 no sube bytes ni genera presigned URLs. Esa responsabilidad queda en R2-4.

R2-0 no incluyó:

- dependencias AWS SDK / S3;
- tablas `storage_connections` o `album_assets`;
- migraciones;
- llamadas reales a Cloudflare R2;
- presigned URLs funcionales;
- UI de fotos;
- cambios Docker.

### Decisiones vigentes

- Cloudflare R2 es BYO Storage.
- `StorageConnection` pertenece al usuario/owner, no al álbum.
- una conexión puede reutilizarse entre varios álbumes;
- un álbum podrá referenciar una conexión de forma nullable para preservar
  compatibilidad con álbumes v0.3.0;
- secretos reversibles R2 reutilizarán `CryptoService` AES-256-GCM;
- los bytes de una foto viajarán normalmente browser -> R2 mediante presigned URL;
- el backend controla el `object_key`;
- `album_assets` será independiente de `album_proposals`;
- owner upload -> `approved`;
- active member upload -> `pending`;
- owner modera pending assets;
- un álbum público muestra únicamente assets `approved`;
- guest/anonymous upload queda fuera de v0.4.0.

## Plan de release

```text
R2-0  Scope + architecture + static foundation gate
R2-1  Storage connection domain + encrypted credentials
R2-2  R2 connection validation API
R2-3  Photo asset domain + migration
R2-4  Presigned upload + completion validation
R2-5  Listing/read/delete + moderation
R2-6  Angular photo UI + public rendering
R2-7  E2E + hardening + release v0.4.0
```

La secuencia puede ajustarse si el repositorio real obliga a cambiar límites,
pero no se implementará toda la release en una sola rama.

## Data Safety

Antes de cualquier migración de `v0.4.0`:

```text
review SQL
   ↓
backup
   ↓
verify
   ↓
apply
   ↓
runtime validation
```

No usar como procedimiento normal:

```text
docker compose down -v
docker volume rm
docker system prune --volumes
DROP DATABASE
TRUNCATE
```

R2-0 no modifica datos persistentes.

## Package versions

Durante R2-0 los paquetes permanecen en `0.3.0`. El target de release es
`v0.4.0`, pero el bump de versión pertenece a la preparación de release, no al
inicio de desarrollo.

## Próximo gate

Desde `photo-domain`:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\storage\verify-r2-3-source.ps1
```

Después: contracts build, API typecheck/tests/build, OpenAPI check, Web typecheck
y `git diff --check`.

Si el source gate queda verde:

```bash
pnpm --filter @irec/api db:generate
```

Revisar el SQL `0004` y detenerse. Antes de aplicar la migración se repite el
Data Safety gate: backup + verify + restore-test.


### R2-4 — Presigned Photo Upload 🚧

Objetivo:

- binding owner-only album -> StorageConnection;
- presigned PUT de 5 minutos;
- intent opaco Redis de 15 minutos;
- key server-controlled con asset id reservado;
- `HeadObject` antes de persistir;
- completion idempotente;
- sin migración 0005;
- sin Angular todavía.
