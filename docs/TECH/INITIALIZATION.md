# Inicialización del repositorio

## Versiones base

```text
Node.js      24.15.0+
pnpm         12.4.1
Angular      22.1.x
NestJS       12.0.x
TypeScript   6.0.x
PostgreSQL   17
Redis        8
OpenAPI      3.1.0
```

## Ruta recomendada — full-stack Docker

Desde `integration/v0.2.0` o, después del release, desde `main`:

Primera vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 setup
```

Levantar:

```bash
docker compose up --build -d
```

Esto no exige Node/pnpm instalados en el host. El build utiliza Node y pnpm
dentro de las imágenes Docker.

## Ruta híbrida — desarrollo por worktree

Requiere Node `24.15.0+` + pnpm `12.4.1` en host.

```bash
corepack enable
pnpm install
powershell.exe -ExecutionPolicy Bypass -File ./scripts/init-local-env.ps1
pnpm dev:infra
pnpm db:apply
powershell.exe -ExecutionPolicy Bypass -File ./scripts/ensure-api.ps1 -StartIfMissing
pnpm dev:web
```

## URLs locales

```text
http://127.0.0.1:4200
http://127.0.0.1:3000/api/health/live
http://127.0.0.1:3000/api/health/ready
http://127.0.0.1:3000/openapi.json
http://127.0.0.1:3000/reference
http://127.0.0.1:8025
```

## Regla

Full-stack Docker es el camino de onboarding/demo/E2E. El modo híbrido se
mantiene para desarrollo con watch/hot reload.
