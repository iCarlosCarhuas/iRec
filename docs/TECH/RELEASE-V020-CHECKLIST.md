# Release checklist — v0.2.0 Identity

## Fase 0 — entradas

```text
[x] main = v0.1.0 estable
[x] feat/backend gate aprobado
[x] feat/frontend gate aprobado
[x] TOTP onboarding aprobado
[x] HyperFrames QA aprobado
[x] docs/project actualizado
```

## Fase 1 — integración

```text
[ ] crear integration/v0.2.0
[ ] merge feat/backend
[ ] merge feat/frontend
[ ] merge docs/project
[ ] resolver conflictos por propiedad
[ ] pnpm install
[ ] working tree limpio
[ ] push integration/v0.2.0
```

## Fase 2 — gate técnico integrado

```text
[ ] pnpm typecheck
[ ] pnpm openapi:check
[ ] pnpm build
[ ] pnpm db:diagnose
[ ] pnpm db:apply
[ ] db:apply repetido = idempotente
[ ] backend gate desde candidato
[ ] frontend gate desde candidato
```

## Fase 3 — full-stack Docker

```text
[ ] apps/api/Dockerfile
[ ] apps/web/Dockerfile
[ ] configuración web/proxy de contenedor
[ ] compose.yaml raíz
[ ] irec-migrate one-shot
[ ] healthchecks
[ ] secretos locales no versionados
[ ] docker compose up --build -d
[ ] docker compose ps OK
[ ] restart idempotente
[ ] persistencia OK
```

## Fase 4 — E2E Identity

```text
[ ] iniciar alta por email
[ ] correo visible en Mailpit
[ ] verificar email
[ ] enrolar TOTP
[ ] confirmar TOTP
[ ] mostrar 10 recovery codes
[ ] logout
[ ] login email + TOTP
[ ] remember device
[ ] restaurar sesión
[ ] listar trusted devices
[ ] revocar device
[ ] recovery por email
[ ] recovery por recovery code
[ ] rotar TOTP
[ ] TOTP anterior inválido
[ ] refresh rotation
[ ] refresh reuse detection/family revocation
```

## Fase 5 — documentación final

```text
[ ] PROJECT-STATE
[ ] TECH changelog
[ ] NONTECH changelog
[ ] OpenAPI version 0.2.0 (sin -dev en release)
[ ] README raíz
[ ] Docker runbook
[ ] evidencias E2E
```

## Fase 6 — main

Crear PR:

```text
integration/v0.2.0 → main
```

Antes de merge:

```text
[ ] CI/gates verdes
[ ] revisión de cambios
[ ] no hay .env/keys/secrets
[ ] documentación sincronizada
```

Después de merge:

```bash
cd /e/MVP/iRec
git switch main
git pull --ff-only origin main
```

Repetir gate final desde `main`.

## Fase 7 — tag/release

Solo con `main` validado:

```bash
git tag -a v0.2.0 -m "iRec v0.2.0 — Identity"
git push origin v0.2.0
```

Crear GitHub Release con resumen TECH/NONTECH.

## Fase 8 — cleanup

```bash
git worktree remove ../iRec-worktrees/v0.2.0
git branch -d integration/v0.2.0
```

La eliminación de las ramas `feat/*` y `docs/project` se decide después de
confirmar que el release/tag y el historial remoto están correctos.
