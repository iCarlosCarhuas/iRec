# Despliegue y ejecución

## Entornos

```text
local-development
local-release-candidate
staging/test
production
```

## Local development — validado

Modo híbrido:

```text
Angular host
NestJS host
irec-postgres Docker
irec-redis Docker
irec-mailpit Docker
```

Infra validada en `feat/backend`:

```text
irec-postgres  127.0.0.1:15432 -> 5432
irec-redis     127.0.0.1:6379
irec-mailpit   127.0.0.1:1025 / 8025
irec-network
```

## Local release candidate — decidido, pendiente de implementación

El worktree `integration/v0.2.0` implementará full-stack Docker:

```text
irec-web
irec-api
irec-migrate
irec-postgres
irec-redis
irec-mailpit
```

Comando objetivo:

```bash
docker compose up --build -d
```

Ver `FULLSTACK-DOCKER.md`.

## Producción prevista

- Angular: CDN/edge hosting o imagen web equivalente.
- NestJS API: contenedor.
- PostgreSQL administrado.
- Redis administrado.
- Email: Resend.
- Media gateway separado en v0.6.
- R2 pertenece a cada usuario final.

El compose local no debe interpretarse como topología final de producción.

## Variables sensibles

Nunca versionar:

- `DATABASE_URL` real;
- `REDIS_URL` real;
- `APP_ENCRYPTION_KEY`;
- JWT private key;
- email credentials;
- Google OAuth client secret;
- R2 secret keys;
- AI provider key.

## JWT keys

Localmente se genera un par RSA. En producción la private key viene de un
secret manager/KMS y nunca se incluye en una imagen Docker o repositorio.

## Health checks

```text
GET /api/health/live
GET /api/health/ready
```

## Migraciones

Flujo oficial:

```text
Drizzle schema
→ drizzle-kit generate
→ SQL versionado
→ drizzle-orm migrator
→ PostgreSQL
```

Comandos de desarrollo:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:apply
```

Para full-stack Docker, el servicio `irec-migrate` ejecutará las migraciones
versionadas antes de iniciar `irec-api`.

`drizzle-kit push` no es el mecanismo oficial.
