# TECH Changelog

Cambios de arquitectura, implementación, infraestructura, API, seguridad y dependencias.

## [Unreleased]

### Added
- Estrategia de Git Worktrees para separar frontend, backend y documentación sin duplicar repositorios.
- Scripts `setup-worktrees.ps1` y `open-worktrees.ps1` para entorno Windows.
- Pendiente de implementación.

## [0.1.0] - 2026-09-14

### Added
- Inicializado monorepo `pnpm` con `apps/web`, `apps/api` y `packages/contracts`.
- Inicializada Angular PWA con app shell y comprobacion de health de API.
- Inicializada NestJS API con `/api/health/live` y `/api/health/ready`.
- OpenAPI 3.1 generado con `zod-openapi` y servido en `/openapi.json`.
- Scalar montado en `/reference`.
- Preparados PostgreSQL y Redis mediante Compose para desarrollo local.
- Fijada base de runtime Node.js 24.15.0 y pnpm 12.4.1.
- Arquitectura base Angular + NestJS + PostgreSQL + Redis.
- Cloudflare R2 mediante API S3 como BYO Storage.
- YouTube Data/Live APIs como plataforma de video.
- Media gateway WebRTC -> RTMPS previsto para live desde PWA.
- Contratos API basados en Zod 4 + `zod-openapi`.
- OpenAPI 3.1 como formato canónico generado.
- Scalar como referencia interactiva.
- Estrategia de documentación contractual `/openapi.json` + `/reference`.
- Modelo conceptual de usuarios, TOTP, recovery, storage, álbumes, assets, temas y YouTube.
- Separación de changelog técnico y no técnico.
- SemVer como política de releases.

### Security
- TOTP sin password tradicional.
- Secrets R2 y refresh tokens cifrados en servidor.
- Recovery codes almacenados como hash.
- Presigned URLs para acceso directo a R2.
- ThemeManifest validado en vez de HTML/JS arbitrario.

### Changed
- R2 deja de considerarse almacenamiento principal para videos.
- YouTube pasa a ser proveedor principal de video/live.

### Fixed
- Versionados los permisos `allowBuilds` de pnpm para `@parcel/watcher`, `esbuild`, `lmdb` y `msgpackr-extract`.
- Eliminada la opcion TypeScript `baseUrl` de la API por estar deprecada en TypeScript 6.
- Ajustados schemas compartidos a sintaxis Zod 4 conservadora para reducir incompatibilidades por helpers.
- Scalar consume directamente el mismo objeto OpenAPI generado por `zod-openapi`, manteniendo `/openapi.json` como endpoint de contrato.
