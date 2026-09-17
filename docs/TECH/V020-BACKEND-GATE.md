# v0.2.0 — Evidencia del gate backend Identity

**Fecha:** 2026-09-15  
**Rama:** `feat/backend`  
**Resultado:** PASSED

## Resultado final

```text
iRec v0.2.0 IDENTITY BACKEND PASSED
Scalar:  http://localhost:3000/reference
Mailpit: http://localhost:8025
```

## Infra

```text
irec-mailpit   healthy
irec-postgres  healthy
irec-redis     healthy
```

PostgreSQL:

```text
PostgreSQL 17.11
database: irec
user: irec
host port: 15432
```

## Tablas verificadas

```text
email_tokens
recovery_codes
totp_credentials
trusted_devices
users
```

## Typecheck

```text
apps/web             OK
packages/contracts   OK
apps/api             OK
```

## OpenAPI

```text
OpenAPI 3.1.0 OK — 18 paths
```

Los 18 paths corresponden a 16 rutas Identity + 2 health endpoints.

## Build

```text
Angular build  OK
NestJS build   OK
```

## Migraciones

```text
No schema changes, nothing to migrate
PostgreSQL OK
Migraciones aplicadas correctamente
```

Esto demuestra que el flujo es idempotente sobre la DB ya migrada.

## Gate siguiente

Este documento no cierra `v0.2.0`.

Faltan:

1. Identity frontend;
2. E2E;
3. integración a `main`;
4. gate final desde `main`;
5. tag/release.
