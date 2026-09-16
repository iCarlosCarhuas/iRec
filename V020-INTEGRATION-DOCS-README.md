# iRec v0.2.0 — documentación de integración

Este paquete se aplica sobre:

```text
E:\MVP\iRec-worktrees\docs
```

Documenta el estado real de las tres ramas actuales y la nueva estrategia de
release candidate:

```text
feat/backend
feat/frontend
docs/project
       ↓
integration/v0.2.0
       ↓
full-stack Docker + E2E
       ↓
main
       ↓
v0.2.0
```

## Archivos nuevos

```text
docs/TECH/INTEGRATION-V020.md
docs/TECH/FULLSTACK-DOCKER.md
docs/TECH/RELEASE-V020-CHECKLIST.md
docs/TECH/ADR/ADR-0012-integration-branch-fullstack-docker.md
```

## Archivos actualizados

```text
README.md
WORKTREE-QUICKSTART.txt
WORKTREES.md
docs/PROJECT-STATE.md
docs/README.md
docs/TECH/WORKTREES.md
docs/TECH/DEPLOYMENT.md
docs/TECH/INITIALIZATION.md
docs/API/OPENAPI-SCALAR.md
docs/VERSIONING.md
docs/TECH/TESTING.md
docs/TECH/CHANGELOG.md
docs/TECH/ADR/README.md
manifest.json
```

## Importante

Este paquete **documenta** el full-stack Docker como siguiente gate. No afirma
que `irec-web`/`irec-api` ya estén dockerizados.

## Commit sugerido

```bash
cd /e/MVP/iRec-worktrees/docs

git status
git add README.md WORKTREE-QUICKSTART.txt WORKTREES.md docs manifest.json V020-INTEGRATION-DOCS-README.md
git status
git commit -m "docs(release): define v0.2.0 integration and full-stack docker"
git push origin docs/project
```
