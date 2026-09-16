# Integración de iRec v0.2.0

## Objetivo

Construir un candidato reproducible de `v0.2.0 — Identity` sin modificar
`main` hasta completar todos los gates.

## Entradas

### `feat/backend` — validado

Responsabilidad observada:

- root/package API en `0.2.0`;
- NestJS Identity;
- contratos auth compartidos;
- Drizzle ORM y migración versionada;
- PostgreSQL 17;
- Redis 8;
- Mailpit;
- JWT RS256;
- refresh rotation + reuse detection;
- TOTP / recovery / trusted devices;
- OpenAPI 3.1 / Scalar;
- infraestructura `irec-*`;
- PostgreSQL host `15432`;
- scripts de `.env`, DB, naming y gate.

### `feat/frontend` — validado

Responsabilidad observada:

- Angular Identity;
- rutas auth/verify/TOTP/recovery/security;
- proxy `/api`;
- cookies con `withCredentials`;
- no tokens en localStorage/sessionStorage;
- trusted devices;
- TOTP rotation;
- recovery codes;
- HyperFrames TOTP inline;
- gate frontend.

### `docs/project` — fuente documental

Responsabilidad:

- PROJECT-STATE;
- TECH/NONTECH changelogs;
- ADRs;
- evidencia de gates;
- arquitectura;
- seguridad;
- documentación API;
- runbooks.

## Salida

```text
integration/v0.2.0
```

Debe ser el primer árbol de esta versión que contenga el sistema completo.

## Procedimiento

```bash
cd /e/MVP/iRec

git fetch origin --prune
git switch main
git pull --ff-only origin main

git worktree add -b integration/v0.2.0 ../iRec-worktrees/v0.2.0 main
cd ../iRec-worktrees/v0.2.0

git merge --no-ff feat/backend \
  -m "merge(v0.2.0): integrate identity backend"

git merge --no-ff feat/frontend \
  -m "merge(v0.2.0): integrate identity frontend"

git merge --no-ff docs/project \
  -m "merge(v0.2.0): integrate project docs"
```

## Conflictos esperables

### `packages/contracts`

Backend y frontend consumen los mismos contratos Identity. Validar que la
versión final exporte todos los schemas/tipos usados por ambos.

### `pnpm-lock.yaml`

Si hay conflicto, resolver a partir del `package.json` integrado y regenerar:

```bash
pnpm install
```

No editar el lockfile a mano salvo una corrección conscientemente revisada.

### documentación

La fuente final debe ser `docs/project`, pero cualquier decisión técnica que
haya evolucionado en backend/frontend debe reconciliarse antes del merge.

## Verificación inmediata post-merge

```bash
pnpm install
pnpm typecheck
pnpm openapi:check
pnpm build
pnpm db:diagnose
```

Infra:

```bash
pnpm dev:infra
pnpm dev:infra:ps
```

Backend:

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/ensure-api.ps1 -StartIfMissing
```

Frontend:

```bash
pnpm dev:web
```

Checks manuales:

```text
http://127.0.0.1:4200
http://127.0.0.1:3000/api/health/live
http://127.0.0.1:3000/api/health/ready
http://127.0.0.1:3000/reference
http://127.0.0.1:8025
```

## Después de integrar: full-stack Docker

El candidato integrado implementará un compose raíz para que la ejecución
completa no dependa de conocer los worktrees.

Objetivo:

```bash
docker compose up --build -d
```

Ver `FULLSTACK-DOCKER.md`.

## Gates antes de main

```text
[ ] working tree limpio
[ ] pnpm install
[ ] typecheck
[ ] OpenAPI 3.1
[ ] build Angular
[ ] build NestJS
[ ] DB migration idempotente
[ ] full-stack Docker smoke
[ ] Scalar accesible
[ ] Mailpit accesible
[ ] E2E Identity completo
[ ] changelogs actualizados
[ ] PROJECT-STATE actualizado
```

## Política de main

No hacer merge a `main` por el simple hecho de que las tres ramas hayan sido
integradas. `integration/v0.2.0` es un release candidate y puede recibir fixes
específicos de integración hasta pasar el gate final.
