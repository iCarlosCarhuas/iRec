# Integración v0.2.0

## Propósito

`integration/v0.2.0` es la única rama donde se considera que existe el
**producto completo candidato** antes de fusionarlo a `main`.

## Fuentes actuales

```text
main           v0.1.0 estable
feat/backend   Identity backend
feat/frontend  Identity frontend
docs/project   documentación v0.2.0
```


## Worktree objetivo

```text
E:\MVP\iRec-worktrees\v0.2.0
```

Rama:

```text
integration/v0.2.0
```

## Creación manual

Desde `E:\MVP\iRec`:

```bash
git fetch origin
git worktree add -b integration/v0.2.0 ../iRec-worktrees/v0.2.0 main
```

Después:

```bash
cd /e/MVP/iRec-worktrees/v0.2.0
git merge --no-ff feat/backend
git merge --no-ff feat/frontend
git merge --no-ff docs/project
```

Cada merge debe terminar limpio antes de continuar con el siguiente.

## Qué hacer con conflictos

No escoger automáticamente "ours" o "theirs" para todo.

Principio:

```text
backend code      → preservar feat/backend
frontend code     → preservar feat/frontend
docs              → preservar docs/project
shared contracts  → combinar ambos cambios
package/lockfile  → representar la suma backend + frontend
```

En particular `pnpm-lock.yaml` debe contener las dependencias Identity del
backend y `@irec/contracts` en el importer del frontend.

Después de resolver:

```bash
git add .
git commit
```

## Docker/DX sobre integración

Después de los tres merges se aplica el bloque full-stack:

```text
compose.yaml
Dockerfiles
Nginx
.env.docker generator
irec.ps1
Docker gate
Scalar Quick Start
```

Este bloque no debe añadirse directamente a `main` antes de pasar sus gates.

## Secuencia completa

```text
main v0.1.0
   │
   ├─ merge feat/backend
   ├─ merge feat/frontend
   ├─ merge docs/project
   ▼
integration/v0.2.0
   │
   ├─ full-stack Docker
   ├─ static/build gates
   ├─ Identity E2E
   ├─ release checklist
   ▼
main
   ▼
tag v0.2.0
```

## Regla para futuras versiones

Repetir el patrón:

```text
integration/v0.3.0
integration/v0.4.0
...
```

La rama `integration/*` es temporal por versión; `main` conserva únicamente
estados que ya pasaron integración.
