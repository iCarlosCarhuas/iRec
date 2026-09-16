# iRec worktrees

Los worktrees de iRec son distintas carpetas asociadas a ramas del mismo
repositorio. No son copias independientes del proyecto ni deben sincronizarse
copiando archivos manualmente.

## Layout de v0.2.0

```text
E:\MVP\
├─ iRec\                         main
└─ iRec-worktrees\
   ├─ backend\                   feat/backend
   ├─ frontend\                  feat/frontend
   ├─ docs\                      docs/project
   └─ v0.2.0\                    integration/v0.2.0
```

## Responsabilidad

| Carpeta | Rama | Rol |
|---|---|---|
| `iRec` | `main` | Última versión estable/integrada |
| `backend` | `feat/backend` | Backend Identity y dependencias de servidor |
| `frontend` | `feat/frontend` | PWA Identity y UX |
| `docs` | `docs/project` | Fuente de verdad documental |
| `v0.2.0` | `integration/v0.2.0` | Candidato completo previo a `main` |

## Regla esencial

Las tres ramas de trabajo de `v0.2.0` todavía no están en `main`. Esto es
intencional: se mantienen aisladas hasta integrarlas en `integration/v0.2.0`,
validar el sistema completo y pasar E2E.

Consulta `docs/TECH/WORKTREES.md` para el procedimiento completo.
