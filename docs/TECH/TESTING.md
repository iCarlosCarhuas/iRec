# Estrategia de pruebas

## Gate real v0.2.0 — backend

El gate backend ejecuta:

```text
pnpm install
pnpm dev:infra
pnpm db:diagnose
pnpm typecheck
pnpm openapi:check
pnpm build
pnpm db:apply
smoke checks
```

Resultado validado el 2026-09-15:

```text
iRec v0.2.0 IDENTITY BACKEND PASSED
```

## Cobertura del gate

- Docker services healthy;
- PostgreSQL readiness;
- consulta DB;
- existencia de tablas;
- TypeScript web/contracts/api;
- OpenAPI 3.1;
- Angular build;
- NestJS build;
- migraciones;
- `/api/health/live`;
- `/api/health/ready`;
- `/openapi.json`;
- `/reference`;
- Mailpit UI.

## E2E Identity pendiente

Debe cubrir:

```text
email
→ verificación
→ QR TOTP
→ confirmación
→ recovery codes
→ logout
→ login
→ remember device
→ session restore / refresh rotation
→ revoke trusted device
→ recovery por email
→ recovery code
→ rotate TOTP
→ TOTP anterior inválido
```

Casos de seguridad:

- TOTP replay;
- brute force/rate limit;
- recovery code reutilizado;
- refresh token reutilizado;
- refresh family revocada;
- JWT expirado/revocado;
- trusted device revocado/expirado;
- anti-enumeración.

## Versiones posteriores

### Unit
- schemas Zod;
- permisos;
- ThemeManifest;
- mappers.

### Integration
- R2;
- YouTube OAuth;
- presigned URLs;
- media gateway.

## Definition of Done

Una historia no se cierra sin:
- tests/gate relevantes;
- OpenAPI actualizado si cambia API;
- changelog;
- documentación;
- migración versionada si cambia DB.
