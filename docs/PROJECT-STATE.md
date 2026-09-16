# Estado actual — iRec

**Corte:** 2026-09-16  
**Release estable:** `v0.1.0`  
**Release candidate:** `v0.2.0 — Identity`

## Ramas/worktrees

```text
E:\MVP\iRec
└─ main
   └─ v0.1.0 estable

E:\MVP\iRec-worktrees\backend
└─ feat/backend
   └─ Identity backend ✅

E:\MVP\iRec-worktrees\frontend
└─ feat/frontend
   └─ Identity frontend + TOTP onboarding ✅

E:\MVP\iRec-worktrees\docs
└─ docs/project
   └─ documentación v0.2.0 ✅

E:\MVP\iRec-worktrees\v0.2.0
└─ integration/v0.2.0
   └─ candidato completo ⏳
```

## Gates

| Gate | Estado |
|---|---|
| Backend Identity | ✅ PASSED |
| Frontend Identity | ✅ PASSED |
| TOTP onboarding | ✅ PASSED |
| HyperFrames QA | ✅ PASSED |
| Integración de las tres ramas | ⏳ pendiente en Git local |
| Full-stack Docker — implementación | ✅ preparada |
| Full-stack Docker — runtime gate | ⏳ pendiente |
| Identity E2E | ⏳ pendiente |
| Merge a `main` | ⏳ pendiente |
| Tag `v0.2.0` | ⏳ pendiente |

## Qué significa "implementación Docker preparada"

El candidato contiene:

```text
compose.yaml
apps/api/Dockerfile
apps/web/Dockerfile
apps/web/nginx.conf
scripts/generate-docker-env.mjs
scripts/irec.ps1
scripts/verify-fullstack-docker.ps1
```

La validación runtime debe ejecutarse en una máquina con Docker Desktop antes
de marcar el gate como aprobado.

## Ejecución objetivo

Primera vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\irec.ps1 setup
```

Luego:

```bash
docker compose up --build -d
```

Resultado esperado:

```text
irec-web
irec-api
irec-migrate (exit 0)
irec-postgres
irec-redis
irec-mailpit
```

## URLs

```text
Web       http://127.0.0.1:4200
API       http://127.0.0.1:3000
Scalar    http://127.0.0.1:3000/reference
Mailpit   http://127.0.0.1:8025
Postgres  127.0.0.1:15432
Redis     127.0.0.1:6379
```

## Próximo movimiento

1. crear `integration/v0.2.0` desde `main`;
2. merge `feat/backend`;
3. merge `feat/frontend`;
4. merge `docs/project`;
5. aplicar el bloque full-stack sobre integración;
6. ejecutar `pnpm verify:docker` o el script equivalente;
7. ejecutar Identity E2E;
8. solo entonces mergear a `main` y etiquetar `v0.2.0`.

No empezar `v0.3.0` antes de cerrar esta secuencia.
