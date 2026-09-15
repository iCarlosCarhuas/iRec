# iRec v0.2.0 — Docs sync after Identity backend gate

Aplicar sobre:

```text
E:\MVP\iRec-worktrees\docs
```

Este ZIP sincroniza la documentación con el estado real validado del proyecto.

## Estado reflejado

- `v0.1.0` Foundation: cerrado.
- `v0.2.0` Identity backend: gate completo aprobado.
- Identity frontend: pendiente.
- E2E Identity: pendiente hasta completar frontend.
- JWT RS256 + refresh opaco rotativo.
- Recovery codes con bcrypt.
- TOTP secret cifrado con AES-256-GCM.
- PostgreSQL + Drizzle con migraciones versionadas.
- Redis para refresh families, revocación, auth flows y rate limiting.
- infraestructura con prefijo obligatorio `irec-*`.
- PostgreSQL local publicado en `127.0.0.1:15432`.
- OpenAPI 3.1 validado con 18 paths.
- Scalar en `/reference`.

## Después de extraer

```bash
cd /e/MVP/iRec-worktrees/docs
git status
git add docs V020-DOCS-SYNC-README.md
git status
git commit -m "docs(identity): sync v0.2.0 backend validated state"
git push -u origin docs/project
```

No crear todavía el tag `v0.2.0`. La versión se cierra después de frontend + E2E + merge a `main`.
