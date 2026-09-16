# Estrategia de Git Worktrees e integración

## Concepto

Un worktree es otra carpeta de trabajo del **mismo repositorio Git** asociada a
otra rama. iRec usa worktrees para mantener `main` estable mientras backend,
frontend y documentación avanzan en paralelo.

No son tres repositorios y no deben sincronizarse copiando carpetas o ZIPs.

## Layout actual

```text
E:\MVP\
├─ iRec\                         # main
└─ iRec-worktrees\
   ├─ backend\                   # feat/backend
   ├─ frontend\                  # feat/frontend
   └─ docs\                      # docs/project
```

## Layout de integración

Antes del E2E de cada release se agrega un worktree candidato:

```text
E:\MVP\iRec-worktrees\v0.2.0
└─ integration/v0.2.0
```

En versiones posteriores se aplica el mismo patrón:

```text
integration/v0.3.0
integration/v0.4.0
...
```

## Responsabilidades

| Rama | Worktree | Responsabilidad | ¿Producto completo? |
|---|---|---|---|
| `main` | `E:\MVP\iRec` | Último release estable | Sí, release anterior |
| `feat/backend` | `...\backend` | Backend/API/DB/infra | No |
| `feat/frontend` | `...\frontend` | Angular/UX | No |
| `docs/project` | `...\docs` | Documentación | No |
| `integration/v0.2.0` | `...\v0.2.0` | Candidato completo | Sí, si pasa gates |

## Por qué las tres ramas aún no están en main

`main` es el baseline estable. Backend y frontend ya pasaron gates aislados,
pero `v0.2.0` todavía no pasó el gate de **integración completa + Docker + E2E**.
Por eso el merge directo a `main` se pospone.

## Crear integration/v0.2.0

Desde Git Bash:

```bash
cd /e/MVP/iRec

git fetch origin --prune
git switch main
git pull --ff-only origin main

git worktree add -b integration/v0.2.0 ../iRec-worktrees/v0.2.0 main
cd ../iRec-worktrees/v0.2.0
```

Si la rama ya existe:

```bash
git worktree add ../iRec-worktrees/v0.2.0 integration/v0.2.0
```

## Integrar las tres ramas

```bash
git merge --no-ff feat/backend \
  -m "merge(v0.2.0): integrate identity backend"

git merge --no-ff feat/frontend \
  -m "merge(v0.2.0): integrate identity frontend"

git merge --no-ff docs/project \
  -m "merge(v0.2.0): integrate project docs"
```

Luego:

```bash
git status
git log --oneline --decorate --graph -20
git push -u origin integration/v0.2.0
```

## Regla para conflictos

No elegir `ours`/`theirs` de forma masiva.

Resolver por propiedad:

```text
API / DB / infra / root package scripts → feat/backend como referencia
Angular / proxy / UI / HyperFrames      → feat/frontend como referencia
ADRs / changelogs / state / runbooks    → docs/project como referencia
```

Los contratos `packages/contracts` fueron tocados por backend y frontend;
deben compararse y quedar como un único contrato compatible con ambos.

## Riesgo importante: snapshots de ramas

Un ZIP exportado de una rama contiene también archivos que esa rama no ha
modificado desde `main`. Por ejemplo, un ZIP de `feat/frontend` puede mostrar
un compose antiguo porque la actualización de infraestructura vive en
`feat/backend`.

Eso **no significa que debamos sobreescribir archivos** al integrar. Git usa el
ancestro común y preserva correctamente los cambios de cada rama.

Por esto:

> Los ZIP se usan para inspección o transferencia puntual; los releases se
> integran con `git merge`.

## Uso diario

Backend:

```bash
cd /e/MVP/iRec-worktrees/backend
pnpm install
pnpm dev:infra
powershell.exe -ExecutionPolicy Bypass -File ./scripts/ensure-api.ps1 -StartIfMissing
```

Frontend:

```bash
cd /e/MVP/iRec-worktrees/frontend
pnpm install
pnpm dev:web
```

Docs:

```bash
cd /e/MVP/iRec-worktrees/docs
```

## Ver worktrees

```bash
git worktree list
```

## Después del release

Una vez `integration/v0.2.0` esté en `main` y exista el tag:

```bash
cd /e/MVP/iRec
git worktree remove ../iRec-worktrees/v0.2.0
git branch -d integration/v0.2.0
```

La rama remota puede eliminarse después de conservar el PR/historial:

```bash
git push origin --delete integration/v0.2.0
```

No eliminar un worktree manualmente mientras Git lo registre.
