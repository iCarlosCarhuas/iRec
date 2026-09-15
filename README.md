# iRec

PWA para crear y compartir albumes digitales tematicos.

**Estado:** MVP foundation  
**Version:** `0.1.0`

## Stack inicial

- Angular 22 PWA
- NestJS 12
- TypeScript 6
- pnpm workspace
- Zod 4
- zod-openapi 6
- OpenAPI 3.1
- Scalar API Reference
- PostgreSQL + Redis preparados para desarrollo local

La arquitectura funcional completa esta en [`docs/`](docs/README.md).

## Requisitos locales

- Node.js `24.15.0+`
- Corepack
- Docker/Podman opcional para PostgreSQL y Redis

## Inicio rapido en Windows PowerShell

```powershell
cd E:\MVP\iRec

corepack enable
pnpm install

# Los builds nativos necesarios ya estan aprobados en pnpm-workspace.yaml.

# Opcional por ahora: levanta PostgreSQL y Redis.
pnpm dev:infra

# Frontend + API
pnpm dev
```

## URLs

| Servicio | URL |
|---|---|
| PWA | http://localhost:4200 |
| API health | http://localhost:3000/api/health/live |
| OpenAPI | http://localhost:3000/openapi.json |
| Scalar | http://localhost:3000/reference |

## Comandos

```bash
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm build
pnpm typecheck
pnpm openapi:check
pnpm openapi:export
```

## Regla de contratos

```text
Zod
  -> zod-openapi
  -> OpenAPI 3.1
  -> /openapi.json
  -> Scalar /reference
```

No existe un `openapi.yaml` manual paralelo.

## Siguiente version

`0.2.0 — Identity`

Implementara verificacion de correo, TOTP, recovery codes, trusted devices y sesiones seguras.


## Worktrees

Para trabajar frontend, backend y documentación en paralelo sin crear copias independientes del repositorio:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-worktrees.ps1
```

Consulta [`WORKTREES.md`](WORKTREES.md).
