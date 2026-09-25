# iRec

> PWA para crear, organizar y compartir álbumes digitales temáticos.

## Estado

```text
release estable      v0.3.0 — Album Core
rama estable         main

historial
v0.1.0 — Foundation
v0.2.0 — Identity
v0.3.0 — Album Core
```

`main` contiene actualmente la release estable `v0.3.0`.

iRec ya cuenta con una base completa de identidad sin contraseña y con el
núcleo funcional de álbumes: creación, membresías, propuestas, moderación y
vista pública.

## Qué incluye v0.3.0

### Identity

- Registro y autenticación sin contraseña.
- Verificación de correo.
- TOTP compatible con Google Authenticator.
- Recovery codes.
- Recuperación por correo.
- Trusted devices.
- JWT RS256 + refresh tokens rotativos.
- Revocación y protección contra reutilización de refresh tokens.

### Album Core

- Crear múltiples álbumes por usuario.
- Título y descripción.
- Visibilidad `public` o `private`.
- Propietario del álbum.
- Invitación de miembros registrados.
- Aceptación de invitaciones.
- Estados `active`, `invited` y `removed`.
- Propuestas de contenido por miembros.
- Moderación owner-only.
- Estados de propuesta: `pending`, `approved` y `rejected`.
- UI Angular para gestión del álbum.
- Vista pública anónima de solo lectura.
- Los álbumes privados no revelan información mediante la ruta pública.

## Quick Start — Docker

La forma recomendada de ejecutar iRec completo es Docker.

Requisitos:

- Git
- Docker Desktop
- Docker Compose v2

No es necesario instalar Node ni pnpm en el host para ejecutar el stack.

### Primera configuración

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 setup
```

### Levantar iRec

```bash
docker compose up --build -d
```

También puede utilizarse:

```bash
pnpm irec:dev
```

si Node y pnpm ya están instalados.

## Servicios

| Recurso | URL |
| --- | --- |
| Web | http://127.0.0.1:4200 |
| API | http://127.0.0.1:3000 |
| Scalar | http://127.0.0.1:3000/reference |
| OpenAPI | http://127.0.0.1:3000/openapi.json |
| Mailpit | http://127.0.0.1:8025 |

PostgreSQL y Redis permanecen dentro de la red Docker del proyecto.

## Estado del stack

```bash
docker compose ps
```

Estado esperado:

```text
irec-postgres   healthy
irec-redis      healthy
irec-mailpit    healthy
irec-migrate    Exited (0)
irec-api        healthy
irec-web        healthy
```

`irec-migrate` es un proceso one-shot. `Exited (0)` significa que terminó
correctamente.

## Logs

```bash
docker compose logs -f
```

API:

```bash
docker compose logs -f irec-api
```

Web:

```bash
docker compose logs -f irec-web
```

## Detener iRec

```bash
docker compose down
```

Esto conserva los volúmenes y los datos locales.

> No usar `docker compose down -v` salvo que se quiera eliminar
> intencionalmente la información persistente.

## Arquitectura local

```text
Browser
  │
  ▼
irec-web :4200
Angular PWA + Nginx
  │
  └── /api
        │
        ▼
irec-api :3000
NestJS
  │
  ├── PostgreSQL
  ├── Redis
  └── Mailpit

irec-migrate
  │
  └── Drizzle migrations
        │
        ▼
     PostgreSQL
        │
        └── exit 0
```

## Album Core

### Usuario autenticado

```text
/albums
```

Permite listar álbumes, crear álbumes e ingresar al detalle según los permisos
del usuario.

### Owner

Puede editar el álbum, cambiar su visibilidad, consultar miembros, invitar o
remover miembros, revisar propuestas y aprobarlas o rechazarlas.

### Member

Puede acceder a álbumes privados donde tiene membresía activa, consultar el
contexto permitido y crear propuestas.

No puede editar el álbum, administrar miembros ni moderar propuestas.

### Vista pública

```text
/a/:albumId
```

Un álbum `public` puede visualizarse sin autenticación.

La vista pública no expone miembros, propuestas, controles de edición ni
acciones administrativas.

Un álbum `private` y un identificador inexistente muestran un estado genérico
sin revelar información del álbum.

## API

Documentación interactiva:

```text
http://127.0.0.1:3000/reference
```

OpenAPI:

```text
http://127.0.0.1:3000/openapi.json
```

Los contratos se definen con Zod y `zod-openapi` genera OpenAPI 3.1.

## Base de datos

iRec utiliza PostgreSQL y Drizzle ORM.

Las migraciones de Album Core están versionadas en:

```text
apps/api/drizzle/
```

Incluyen álbumes, membresías, propuestas y moderación.

Las migraciones se aplican mediante `irec-migrate`.

## Data Safety

iRec incluye herramientas para proteger PostgreSQL durante desarrollo y
migraciones:

```text
scripts/data/irec-data.ps1
scripts/data/README.md
```

Incluyen flujos de status, backup, list, verify, restore-test y restore
protegido.

Las operaciones destructivas deben ejecutarse explícitamente y con
confirmación.

## Quality Gates

Album Core dispone de gates incrementales:

```text
scripts/album/verify-ad1.ps1
scripts/album/verify-ad2.ps1
scripts/album/verify-ad3.ps1
scripts/album/verify-ad4.ps1
scripts/album/verify-ad5.ps1
scripts/album/verify-ad6.ps1
```

Gate final de release:

```text
scripts/release/verify-v030.ps1
```

Valida versiones, Docker Compose, contracts, API, tests, OpenAPI, builds y
reproducibilidad del build Docker.

## Documentación

Punto de entrada:

```text
docs/README.md
```

Album API:

```text
docs/API/ALBUMS.md
docs/API/ALBUM-MEMBERS.md
docs/API/ALBUM-PROPOSALS.md
```

Frontend:

```text
docs/FRONTEND/ALBUM-UI.md
docs/FRONTEND/PUBLIC-ALBUM-VIEW.md
```

Release:

```text
docs/RELEASE/V0.3.0.md
docs/RELEASE/V0.3.0-E2E.md
```

Changelogs:

```text
docs/TECH/CHANGELOG.md
docs/NONTECH/CHANGELOG.md
```

## Desarrollo con worktrees

El proyecto utiliza ramas de feature y ramas de integración antes de publicar
una release en `main`.

Los worktrees son una técnica de desarrollo y no son necesarios para una
persona que solo quiera ejecutar iRec.

Para utilizar la release estable basta con clonar `main` o descargar su ZIP.

## Roadmap

```text
v0.1.0  Foundation       ✅
v0.2.0  Identity         ✅
v0.3.0  Album Core       ✅

v0.4.0  R2 + Photos      ⏭️
v0.5.0  AI Theme
v0.6.0  YouTube + Live
v0.7.0  Hardening
v1.0.0  MVP
```

## Release actual

```text
iRec v0.3.0 — Album Core
```

Tag:

```text
v0.3.0
```
