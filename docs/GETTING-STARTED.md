# Getting Started

Esta guía separa claramente **ejecución del producto completo** de **desarrollo
por worktrees**.

## 1. Para alguien nuevo: Docker full-stack

### Requisitos

- Git.
- Docker Desktop con Linux Engine activo.
- Docker Compose v2.

Node y pnpm no son obligatorios para ejecutar el candidato full-stack.

### Primera ejecución

Desde la raíz del repositorio integrado:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 setup
```

`setup`:

1. comprueba Docker;
2. genera `.env.docker` únicamente si no existe;
3. genera AES-256 y RSA locales usando Node dentro de Docker;
4. valida `compose.yaml`;
5. nunca regenera secretos existentes automáticamente.

Después:

```bash
docker compose up --build -d
```

También se puede usar:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 up
```

Este wrapper levanta el stack, espera `/api/health/ready`, comprueba la Web e
imprime las URLs.

### URLs

```text
Web       http://127.0.0.1:4200
API       http://127.0.0.1:3000
Scalar    http://127.0.0.1:3000/reference
OpenAPI   http://127.0.0.1:3000/openapi.json
Mailpit   http://127.0.0.1:8025
Postgres  127.0.0.1:15432
Redis     127.0.0.1:6379
```

### Qué ocurre durante `up`

```text
irec-postgres → healthy
       │
       ▼
irec-migrate → Drizzle migrations → exit 0
       │
       ├─────────────┐
       ▼             ▼
irec-redis        irec-mailpit
       │             │
       └──────┬──────┘
              ▼
           irec-api → healthy
              │
              ▼
           irec-web
```

La API no arranca si la migración falla.

## 2. Flujo Identity local

```text
http://127.0.0.1:4200/auth
        ↓
crear acceso
        ↓
Mailpit :8025
        ↓
verificar email
        ↓
/auth/totp/setup
        ↓
Google Authenticator / TOTP compatible
        ↓
recovery codes
        ↓
logout / login / trusted device / recovery
```

## 3. Día siguiente

Si el código no cambió:

```bash
docker compose up -d
```

Si cambió API/Web/dependencias:

```bash
docker compose up --build -d
```

## 4. Detener

Sin borrar datos:

```bash
docker compose down
```

Destructivo:

```bash
docker compose down -v
```

El segundo comando elimina únicamente los volúmenes full-stack:

```text
irec-fullstack-postgres-data
irec-fullstack-redis-data
```

## 5. Comandos auxiliares

Con PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 doctor
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 status
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 logs
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 down
```

Con pnpm instalado:

```bash
pnpm irec:doctor
pnpm irec:setup
pnpm irec:dev
pnpm irec:status
pnpm irec:logs
pnpm irec:stop
```

## 6. Desarrollo híbrido

Los desarrolladores pueden seguir usando:

```text
Angular/NestJS → host
Postgres/Redis/Mailpit → Docker
```

Infra:

```bash
pnpm dev:infra
```

API:

```bash
pnpm dev:api
```

Web:

```bash
pnpm dev:web
```

Este modo usa `infra/docker-compose.dev.yml` y no debe ejecutarse a la vez que
el full-stack, porque ambos reservan nombres/puertos similares.

## 7. Worktrees

Los worktrees separan ramas de desarrollo:

```text
backend  → feat/backend
frontend → feat/frontend
docs     → docs/project
v0.2.0   → integration/v0.2.0
```

No son copias independientes del producto ni se sincronizan por copiar
carpetas. Git integra cambios mediante merge.
