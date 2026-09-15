# Despliegue

## Entornos

- local;
- test/staging;
- production.

## Local validado

```text
irec-postgres  127.0.0.1:15432 -> 5432
irec-redis     127.0.0.1:6379
irec-mailpit   127.0.0.1:1025 / 8025
```

Los nombres Docker siguen `irec-<contexto>`.

## Producción prevista

- Angular: CDN/edge hosting.
- NestJS API: contenedor.
- PostgreSQL administrado.
- Redis administrado.
- Email: Resend.
- Media gateway separado en v0.6.
- R2 pertenece a cada usuario final.

## Variables sensibles

Nunca versionar:

- `DATABASE_URL`;
- `REDIS_URL`;
- `APP_ENCRYPTION_KEY`;
- JWT private key;
- email credentials;
- Google OAuth client secret;
- R2 secret keys;
- AI provider key.

## JWT keys

Localmente se genera un par RSA.
En producción la private key debe venir de un secret manager/KMS y nunca
incluirse en imagen Docker o repositorio.

## Health checks

```text
/api/health/live
/api/health/ready
```

## Migraciones

Flujo oficial:

```text
drizzle schema
→ drizzle-kit generate
→ SQL versionado
→ drizzle-orm migrator
→ PostgreSQL
```

Comandos:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:apply
```

No modificar una migración ya aplicada en un entorno compartido.
`drizzle-kit push` no es el mecanismo oficial del proyecto.
