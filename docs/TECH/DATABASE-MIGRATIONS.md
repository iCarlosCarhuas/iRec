# Migraciones de base de datos

A partir de `v0.2.0`, iRec no usa `drizzle-kit push` como flujo oficial.

## Flujo

```text
Drizzle schema
    ↓
drizzle-kit generate
    ↓
SQL versionado: apps/api/drizzle/
    ↓
drizzle-orm/node-postgres migrator
    ↓
PostgreSQL
```

## Comandos

```bash
pnpm db:diagnose
pnpm db:generate
pnpm db:migrate
pnpm db:apply
```

`db:apply` genera y luego aplica.

## Primera migración Identity

La primera migración creó:

```text
users
email_tokens
totp_credentials
recovery_codes
trusted_devices
```

## Regla

- `apps/api/drizzle/` entra a Git;
- nunca editar una migración ya aplicada en entorno compartido;
- cambios posteriores generan una migración nueva;
- el gate debe comprobar idempotencia.
