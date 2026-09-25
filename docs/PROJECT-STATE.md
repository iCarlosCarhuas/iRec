# Estado actual — iRec

**Corte:** 2026-09-25
**Release estable:** `v0.3.0 — Album Core`
**Release objetivo:** `v0.4.0 — R2 + Photos`
**Etapa actual:** `R2-0 — R2 + Photos Foundation`

## Estado Git de inicio de v0.4.0

El preflight local confirmó:

```text
main                        -> 20cfbd7
integration/v0.4.0          -> 20cfbd7
chore/v040-r2-foundation    -> 20cfbd7
v0.3.0 tag                  -> 0a0767c
```

Worktrees activos para la nueva release:

```text
E:\MVP\iRec
└─ main

E:\MVP\iRec-worktrees\v0.4.0
└─ integration/v0.4.0

E:\MVP\iRec-worktrees\r2-foundation
└─ chore/v040-r2-foundation
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

### R2-0 — Foundation

R2-0 solo fija el estado real del proyecto, arquitectura, decisiones y gate de
foundation.

No incluye todavía:

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

Ejecutar desde el worktree `r2-foundation`:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\storage\verify-r2-0.ps1
```

R2-0 no se considera completado hasta revisar además `git diff`, `git status`,
typechecks/builds aplicables y hacer merge a `integration/v0.4.0`.
