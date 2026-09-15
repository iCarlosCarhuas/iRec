# Inicializacion del repositorio

## Version base

- Node.js: `24.15.0+`
- pnpm: `12.4.1`
- Angular: `22.1.x`
- NestJS: `12.0.x`
- TypeScript: `6.0.x`
- zod-openapi: `6.0.x`
- OpenAPI: `3.1.0`

## Verificacion local

```powershell
corepack enable
pnpm install
# No debe solicitar approve-builds: allowBuilds esta versionado.
pnpm typecheck
pnpm openapi:check
pnpm dev
```

Comprobar:

- `http://localhost:4200`
- `http://localhost:3000/api/health/live`
- `http://localhost:3000/api/health/ready`
- `http://localhost:3000/openapi.json`
- `http://localhost:3000/reference`

## Infra opcional

```powershell
pnpm dev:infra
docker compose -f infra/docker-compose.dev.yml ps
```

## Criterio de salida de Foundation

La version `0.1.0` se considera inicializada cuando:

1. `pnpm install` genera el lockfile.
2. web y api levantan simultaneamente.
3. health responde 200.
4. `pnpm openapi:check` pasa.
5. Scalar renderiza el contrato generado.
6. `pnpm build` finaliza sin errores.
7. se crea el primer commit del repositorio.
