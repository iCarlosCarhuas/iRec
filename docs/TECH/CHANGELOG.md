# TECH Changelog

Cambios de arquitectura, implementación, infraestructura, API, seguridad y dependencias.

## [Unreleased]

## [0.3.0] - 2026-09-25

### Album Core

#### Added
- Dominio persistente de álbumes con propietario, título, descripción y visibilidad `public|private`.
- Membresías por álbum con roles `owner|member` y estados `active|invited|removed`.
- Invariante de creación: el propietario queda registrado como miembro `owner/active` dentro de la misma transacción.
- API para crear, listar, consultar y editar álbumes.
- API de miembros para listar, invitar por correo, aceptar invitaciones y remover membresías sin borrar el registro.
- Propuestas de contenido de texto con estados `pending|approved|rejected`.
- Moderación owner-only para aprobar o rechazar propuestas.
- UI Angular para listado, creación, detalle, edición, miembros, invitaciones, propuestas y moderación.
- Ruta de aceptación de invitación autenticada.
- Vista pública anónima de solo lectura en `/a/:albumId`.
- Estado público genérico para álbum privado o inexistente, evitando revelar sus datos.
- Baseline de Data Safety para backup, verificación, restore-test y restore protegido de PostgreSQL.
- Gates versionados AD-1 a AD-6 y documentación técnica de Album Core.

#### Database
- Migración aditiva `0001_spotty_forgotten_one.sql` para álbumes y membresías.
- Migración aditiva `0002_volatile_raza.sql` para propuestas y moderación.
- Sin operaciones de borrado, truncado o reset como parte del release.

#### Security / Authorization
- Álbum privado accesible solo por owner o miembro activo.
- Edición del álbum y administración de miembros restringidas al owner.
- Creación de propuestas restringida a miembros activos distintos del owner.
- Moderación restringida al owner.
- Vista pública no expone roster, propuestas ni controles autenticados.

#### Validation
- Source gates AD-1 a AD-6 incorporados al repositorio.
- Gate de release `scripts/release/verify-v030.ps1` para contracts, API, OpenAPI y Web.
- Matriz Runtime/E2E documentada en `docs/RELEASE/V0.3.0-E2E.md`.


## [0.2.0]

### Identity

#### Added
- Estrategia `integration/vX.Y.Z` para ensamblar release candidates sin usar `main` como área de integración.
- Worktree de release `E:\MVP\iRec-worktrees\v0.2.0`.
- Full-stack Docker definido como gate reproducible de onboarding/E2E.
- `compose.yaml` full-stack con `irec-web`, `irec-api`, `irec-migrate`, PostgreSQL, Redis y Mailpit.
- Dockerfile de API con Node 24.15.0 + pnpm 12.4.1.
- Dockerfile de Web con Angular production build + Nginx.
- Proxy Nginx `/api` hacia `irec-api`.
- Generador idempotente de `.env.docker` con AES-256/RSA locales.
- Wrapper `scripts/irec.ps1` para doctor/setup/up/down/status/logs.
- Gate `verify-fullstack-docker.ps1`.
- Quick Start full-stack visible también en Scalar/OpenAPI `info.description`.
- ADR-0012 para rama de integración + Docker completo local.
- Checklist de release `v0.2.0` y runbook de integración.
- Backend Identity implementado con NestJS.
- PostgreSQL + Drizzle ORM para identidad persistente.
- Redis para auth flows, refresh families, revocación y rate limiting.
- Mailpit para correo local y adapter preparado para Resend.
- JWT RS256 de acceso en cookie `irec_access`.
- Refresh token opaco rotativo en cookie `irec_refresh`.
- Endpoint explícito `POST /auth/refresh`.
- Detección de reutilización de refresh token y revocación de familia.
- Cookie temporal `irec_auth_flow` para enrolamiento/recuperación.
- Trusted devices mediante `irec_trusted`.
- TOTP con QR, rotación y replay protection por timestep.
- 10 recovery codes de un solo uso.
- AES-256-GCM para secreto TOTP.
- bcrypt (cost 12) para recovery codes.
- OpenAPI 3.1 validado con 18 paths.
- Scalar en `/reference`.
- Migraciones Drizzle versionadas.
- Scripts `db:diagnose`, `db:generate`, `db:migrate`, `db:apply`.
- Gate `verify-identity-backend.ps1`.
- Convención global `irec-<contexto>` para recursos técnicos.
- PostgreSQL local aislado en host `15432`.

- Frontend Identity Angular validado.
- Rutas Identity lazy-loaded.
- Auth store sin JWT/refresh en localStorage.
- Proxy local `/api -> 127.0.0.1:3000`.
- Onboarding TOTP integrado en `/auth/totp/setup`.
- HyperFrames tutorial inline.
- HyperFrames QA con contraste 73/73 WCAG AA.
- Host Angular local fijado a `127.0.0.1:4200`.
- Helper de detección de API existente para evitar `EADDRINUSE`.

#### Changed
- Se reemplazó la propuesta inicial de sesión opaca principal por JWT RS256
  corto + refresh opaco rotativo.
- Redis ya no se describe solo como store de sesión: mantiene estado de
  refresh families, reuse detection, auth flows, revocación y rate limits.
- Recovery codes pasan de una propuesta HMAC a bcrypt.
- `drizzle-kit push` deja de ser el mecanismo oficial; se usan migraciones
  generadas y aplicadas por `drizzle-orm`.
- Infraestructura Docker pasa de nombres `infra-*` a `irec-*`.
- PostgreSQL host cambia de `5432` a `15432`.

#### Fixed
- Compatibilidad TypeScript con `otplib 13`.
- Compatibilidad de claves con `jose 6`.
- Import TypeScript de `ioredis 6`.
- Carrera de startup Docker mediante `docker compose up -d --wait`.
- Diagnóstico de DB que antes podía dar falso positivo usando socket interno.

#### Security
- Access JWT: issuer `irec`, audience `irec-web`, `jti`, expiración corta.
- Refresh tokens de alta entropía se almacenan por hash SHA-256 en Redis.
- Reuso de refresh token ya consumido revoca la familia.
- Logout revoca el JWT restante y la familia refresh cuando corresponde.
- TOTP secreto cifrado con AES-256-GCM.
- Recovery codes almacenados con bcrypt.
- Anti-enumeración y rate limits por IP/cuenta.
- Cookies HttpOnly + SameSite=Lax; `Secure` en producción.

#### Validation
- Gate backend v0.2.0 aprobado el 2026-09-15.
- Gate frontend v0.2.0 aprobado el 2026-09-15.
- HyperFrames TOTP QA aprobado el 2026-09-15.
- Typecheck web/contracts/api: OK.
- OpenAPI 3.1: OK, 18 paths.
- Angular build: OK.
- NestJS build: OK.
- DB migrations: OK.
- Smoke checks: OK.
- HyperFrames runtime/layout/motion: OK.
- HyperFrames contrast: 73/73 WCAG AA.
- Integración estática full-stack validada el 2026-09-16: JSON/YAML, servicios Compose, lockfile combinado, imports relativos y generador de secretos.
- Gate Docker runtime: pendiente de ejecución en host con Docker Desktop.

## [0.1.0] - 2026-09-14

### Added
- Arquitectura base Angular + NestJS + PostgreSQL + Redis.
- Cloudflare R2 mediante API S3 como BYO Storage.
- YouTube Data/Live APIs como plataforma de video.
- Media gateway WebRTC -> RTMPS previsto para live desde PWA.
- Contratos API basados en Zod 4 + `zod-openapi`.
- OpenAPI 3.1 como formato canónico generado.
- Scalar como referencia interactiva.
- Estrategia `/openapi.json` + `/reference`.
- Modelo conceptual de usuarios, storage, álbumes, assets, temas y YouTube.
- Separación de changelog técnico y no técnico.
- SemVer como política de releases.
