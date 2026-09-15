# Estrategia de Git Worktrees

iRec usa una rama principal y worktrees separados para reducir interferencias entre frentes de trabajo.

## Layout recomendado en Windows

```text
E:\MVP\
├─ iRec\                         # rama main
└─ iRec-worktrees\
   ├─ frontend\                  # rama feat/frontend
   ├─ backend\                   # rama feat/backend
   └─ docs\                      # rama docs/project
```

## Ramas

| Worktree | Rama | Responsabilidad |
|---|---|---|
| `E:\MVP\iRec` | `main` | Integración estable |
| `...\frontend` | `feat/frontend` | Angular PWA |
| `...\backend` | `feat/backend` | NestJS, API, DB e integraciones |
| `...\docs` | `docs/project` | Documentación, ADRs y changelogs |

## Regla

Los worktrees **no son repositorios separados**. Comparten el mismo `.git` e historial.

Eso significa que:

- un commit hecho en `frontend` existe inmediatamente en el repositorio;
- una rama no puede estar checkout simultáneamente en dos worktrees;
- `main` se mantiene estable;
- las integraciones se hacen mediante merge/rebase desde el worktree principal.

## Primera instalación

Desde `E:\MVP\iRec`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-worktrees.ps1
```

El script:

1. inicializa Git si todavía no existe;
2. crea el commit `chore: initialize iRec v0.1.0`;
3. crea las ramas;
4. crea los tres worktrees.

## Uso diario

Frontend:

```powershell
cd E:\MVP\iRec-worktrees\frontend
pnpm install
pnpm dev:web
```

Backend:

```powershell
cd E:\MVP\iRec-worktrees\backend
pnpm install
pnpm dev:api
```

Documentación:

```powershell
cd E:\MVP\iRec-worktrees\docs
```

## Integrar cambios

Ejemplo desde `main`:

```powershell
cd E:\MVP\iRec
git switch main
git merge feat/backend
git merge feat/frontend
git merge docs/project
```

Antes de integrar:

```powershell
pnpm typecheck
pnpm openapi:check
pnpm build
```

## Eliminar un worktree

```powershell
git worktree remove E:\MVP\iRec-worktrees\frontend
```

No borres manualmente una carpeta de worktree si Git todavía la registra.

## Ver worktrees

```powershell
git worktree list
```
