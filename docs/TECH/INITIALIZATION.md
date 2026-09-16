# Inicialización del repositorio

## Versiones base

- Node.js: `24.15.0+`
- pnpm: `12.4.1`
- Angular: `22.1.x`
- NestJS: `12.0.x`
- TypeScript: `6.0.x`
- PostgreSQL: `17`
- Redis: `8`
- OpenAPI: `3.1.0`

## Qué significa “levantar iRec” hoy

Mientras `v0.2.0` siga dividido en ramas, el modo funcional es híbrido.

Desde el candidato integrado o backend:

```bash
corepack enable
pnpm install
powershell.exe -ExecutionPolicy Bypass -File ./scripts/init-local-env.ps1
pnpm dev:infra
pnpm db:apply
powershell.exe -ExecutionPolicy Bypass -File ./scripts/ensure-api.ps1 -StartIfMissing
```

Frontend:

```bash
pnpm dev:web
```

Comprobar:

```text
http://127.0.0.1:4200
http://127.0.0.1:3000/api/health/live
http://127.0.0.1:3000/api/health/ready
http://127.0.0.1:3000/openapi.json
http://127.0.0.1:3000/reference
http://127.0.0.1:8025
```

## Estado objetivo de v0.2.0

Después de implementar full-stack Docker en `integration/v0.2.0`:

```bash
docker compose up --build -d
```

será la ruta recomendada para onboarding, demo y E2E.

El modo híbrido seguirá disponible para desarrollo por worktree.
