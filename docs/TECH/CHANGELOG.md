# TECH Changelog

Cambios de arquitectura, implementación, infraestructura, API, seguridad y dependencias.

## [Unreleased]

### v0.2.0 — Identity (en integración)

#### Added
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
- Typecheck web/contracts/api: OK.
- OpenAPI 3.1: OK, 18 paths.
- Angular build: OK.
- NestJS build: OK.
- DB migrations: OK.
- Smoke checks: OK.

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
