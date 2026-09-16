# iRec v0.2.0 — Integration Full-stack Docker Drop-in

Este paquete **no sustituye los merges Git**. Se aplica sobre el worktree
`integration/v0.2.0` después de integrar las tres ramas.

## 1. Crear el candidato

Desde `E:\MVP\iRec`:

```bash
git fetch origin --prune
git switch main
git pull --ff-only origin main
git worktree add -b integration/v0.2.0 ../iRec-worktrees/v0.2.0 main
```

## 2. Fusionar ramas

```bash
cd /e/MVP/iRec-worktrees/v0.2.0

git merge --no-ff feat/backend -m "merge(v0.2.0): integrate identity backend"
git merge --no-ff feat/frontend -m "merge(v0.2.0): integrate identity frontend"
git merge --no-ff docs/project -m "merge(v0.2.0): integrate project docs"
```

Si aparece un conflicto, no continúes con el siguiente merge hasta resolverlo.

Puntos compartidos importantes:

```text
packages/contracts  → conservar schemas backend + tipos usados por frontend
package.json         → conservar scripts DB/backend + scripts DX/full-stack
pnpm-lock.yaml       → debe representar backend Identity + frontend contracts
```

El drop-in incluye `package.json` y `pnpm-lock.yaml` ya consolidados como
referencia final para estos dos archivos.

## 3. Aplicar este ZIP

Extraer el contenido directamente sobre:

```text
E:\MVP\iRec-worktrees\v0.2.0
```

Luego:

```bash
git status
git add .
git commit -m "feat(integration): add v0.2.0 full-stack docker bootstrap"
git push -u origin integration/v0.2.0
```

Nunca agregar `.env.docker` al commit.

## 4. Primera ejecución

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/irec.ps1 setup
```

Después:

```bash
docker compose up --build -d
```

O:

```bash
pnpm irec:dev
```

## 5. Gate

```bash
powershell.exe -ExecutionPolicy Bypass -File ./scripts/verify-fullstack-docker.ps1
```

Esperado:

```text
irec-postgres   healthy
irec-redis      healthy
irec-migrate    exited (0)
irec-api        healthy
irec-web        healthy
irec-mailpit    running
```

## 6. Estado de validación de este paquete

Validado estáticamente antes de entrega:

```text
JSON manifests                            OK
compose.yaml YAML                         OK
6 servicios requeridos                   OK
lock integrado backend + frontend        OK
imports TypeScript relativos              OK
.env.docker generator syntax             OK
generación AES-256/RSA                    OK
no-regeneración idempotente del env       OK
```

No se ejecutó el build/runtime Docker en el entorno de generación porque ese
entorno no dispone de Docker daemon. Ese es precisamente el gate que debes
ejecutar en tu máquina antes del E2E.
