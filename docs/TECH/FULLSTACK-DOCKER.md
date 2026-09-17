# Full-stack Docker local

## Estado

**Implementado en el candidato `integration/v0.2.0`. Gate runtime pendiente.**

El objetivo es que una persona pueda levantar iRec completo sin conocer la
separación interna de worktrees.

## Archivos

```text
compose.yaml
.dockerignore
.env.docker.example
apps/api/Dockerfile
apps/web/Dockerfile
apps/web/nginx.conf
scripts/generate-docker-env.mjs
scripts/irec.ps1
scripts/verify-fullstack-docker.ps1
```

## Servicios

```text
irec-web       Angular production build servido por Nginx
irec-api       NestJS Identity API
irec-migrate   Drizzle migrations one-shot
irec-postgres  PostgreSQL 17
irec-redis     Redis 8
irec-mailpit   SMTP/UI local
```

## Dependencias de arranque

```text
irec-postgres healthy
        ↓
irec-migrate exit 0
        ↓
irec-api
  ├─ requiere Redis healthy
  └─ requiere Mailpit started
        ↓
irec-api healthy
        ↓
irec-web
```

`irec-migrate` ejecuta:

```text
node dist/database/migrate.js
```

No usa `drizzle-kit push`.

## Red interna

Red Docker:

```text
irec-fullstack-network
```

Dentro de Docker:

```text
PostgreSQL  irec-postgres:5432
Redis       irec-redis:6379
SMTP        irec-mailpit:1025
API         irec-api:3000
```

`127.0.0.1` dentro de un contenedor nunca se usa para hablar con otro
contenedor.

## Puertos host

| Servicio | Host |
|---|---|
| Web | `127.0.0.1:4200` |
| API | `127.0.0.1:3000` |
| Mailpit SMTP | `127.0.0.1:1025` |
| Mailpit UI | `127.0.0.1:8025` |
| PostgreSQL | `127.0.0.1:15432` |
| Redis | `127.0.0.1:6379` |

## Web

Angular se construye en una imagen Node 24.15.0 y el resultado de producción
se copia a Nginx.

Nginx:

- sirve SPA/PWA;
- usa fallback a `index.html`;
- expone `/healthz`;
- proxyea `/api/*` hacia `irec-api:3000`.

Por eso el frontend sigue usando rutas relativas `/api` y no necesita una URL
de backend hardcodeada.

## API

La imagen API:

1. usa Node `24.15.0-alpine`;
2. activa pnpm `12.4.1` con Corepack;
3. instala con lockfile congelado;
4. construye `@irec/contracts`;
5. construye `@irec/api`;
6. arranca `node dist/main.js`;
7. escucha en `0.0.0.0:3000`.

Healthcheck:

```text
GET /api/health/ready
```

## Secretos locales

`.env.docker` está ignorado por Git.

Primera vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 setup
```

El generador crea:

- `APP_ENCRYPTION_KEY` de 32 bytes;
- clave privada RSA PKCS#8;
- clave pública RSA SPKI;
- configuración local Docker.

Regla de seguridad:

> si `.env.docker` ya existe, no se regenera automáticamente.

Para regenerarlo debe hacerse de forma intencional, entendiendo que cambiará
el material criptográfico local.

## Persistencia

Full-stack usa volúmenes propios:

```text
irec-fullstack-postgres-data
irec-fullstack-redis-data
```

No reutiliza los volúmenes del compose híbrido. Esto evita mezclar el estado
de desarrollo por ramas con el estado del release candidate.

## Comandos

Bootstrap:

```bash
pnpm irec:setup
```

Levantar:

```bash
pnpm irec:dev
```

O directamente:

```bash
docker compose up --build -d
```

Estado:

```bash
pnpm irec:status
```

Logs:

```bash
pnpm irec:logs
```

Detener:

```bash
pnpm irec:stop
```

## Colisión con modo híbrido

`infra/docker-compose.dev.yml` usa contenedores como `irec-postgres` e
`irec-redis`. Antes de full-stack debe detenerse:

```bash
pnpm dev:infra:down
```

El wrapper `irec.ps1 up` detecta contenedores iRec pertenecientes a otro
proyecto Compose y falla con un mensaje explícito en lugar de destruirlos.

## Gate

Ejecutar:

```bash
pnpm verify:docker
```

Comprueba:

```text
Docker daemon
compose.yaml
full-stack build/up
Web /
API live
API ready
OpenAPI
Scalar
Mailpit
irec-migrate exit 0
```

La prueba de persistencia e Identity E2E se ejecutará después del gate técnico
Docker.
