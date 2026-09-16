# iRec

> PWA para crear, organizar y compartir álbumes digitales temáticos.

## Estado

```text
release estable      v0.1.0 — Foundation
release candidate    v0.2.0 — Identity
rama de integración  integration/v0.2.0
```

`main` conserva la versión estable. El backend, frontend y documentación de
Identity se desarrollan en ramas separadas y se validan juntos en
`integration/v0.2.0` antes de llegar a `main`.

## Quick Start — proyecto completo con Docker

La ejecución full-stack no requiere Node ni pnpm instalados en el host. Sí
requiere Git, Docker Desktop y Docker Compose v2.

Primera vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 setup
```

Levantar iRec completo:

```bash
docker compose up --build -d
```

O, si ya tienes Node/pnpm:

```bash
pnpm irec:dev
```

URLs:

| Recurso | URL |
|---|---|
| Web | http://127.0.0.1:4200 |
| API | http://127.0.0.1:3000 |
| Scalar | http://127.0.0.1:3000/reference |
| OpenAPI | http://127.0.0.1:3000/openapi.json |
| Mailpit | http://127.0.0.1:8025 |
| PostgreSQL | 127.0.0.1:15432 |
| Redis | 127.0.0.1:6379 |

Estado:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs -f
```

Detener sin borrar datos:

```bash
docker compose down
```

> `docker compose down -v` es destructivo: elimina los volúmenes locales del
> candidato full-stack.

## Arquitectura local full-stack

```text
Browser
  │
  ▼
irec-web :4200 (Nginx + Angular PWA)
  │
  └── /api ──► irec-api :3000 (NestJS)
                    │
                    ├──► irec-postgres :5432
                    ├──► irec-redis :6379
                    └──► irec-mailpit :1025

irec-migrate
  └── Drizzle versionado → PostgreSQL → exit 0
```

## Desarrollo por worktrees

```text
E:\MVP\iRec                    main
E:\MVP\iRec-worktrees\backend  feat/backend
E:\MVP\iRec-worktrees\frontend feat/frontend
E:\MVP\iRec-worktrees\docs     docs/project
E:\MVP\iRec-worktrees\v0.2.0   integration/v0.2.0
```

Los worktrees son una técnica de desarrollo, no un requisito para ejecutar el
producto. Una persona que solo quiere levantar iRec debe usar el clon integrado
y Docker.

## Documentación

Punto de entrada:

```text
docs/README.md
```

Arranque:

```text
docs/GETTING-STARTED.md
```

Integración/release:

```text
docs/TECH/INTEGRATION-V020.md
docs/TECH/FULLSTACK-DOCKER.md
docs/TECH/RELEASE-V020-CHECKLIST.md
```

API:

```text
http://127.0.0.1:3000/reference
```

Zod define contratos, `zod-openapi` genera OpenAPI 3.1 y Scalar lo renderiza.
