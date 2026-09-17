# Documentación iRec

## Punto de entrada

Para retomar el proyecto:

1. `PROJECT-STATE.md` — estado exacto y próximo gate.
2. `GETTING-STARTED.md` — cómo levantar iRec.
3. `TECH/INTEGRATION-V020.md` — cómo se unen las ramas.
4. `TECH/FULLSTACK-DOCKER.md` — arquitectura Docker.
5. `TECH/RELEASE-V020-CHECKLIST.md` — cierre de `v0.2.0`.

## API

```text
API/AUTH.md
API/CONTRACT-GOVERNANCE.md
API/OPENAPI-SCALAR.md
```

## Backend

```text
BACKEND/IDENTITY.md
BACKEND/AUTH-TOTP.md
BACKEND/R2.md
BACKEND/AI-THEMES.md
BACKEND/YOUTUBE.md
```

## Frontend

```text
FRONTEND/PLAN.md
FRONTEND/TOTP-ONBOARDING.md
```

## Técnica

```text
TECH/ARCHITECTURE.md
TECH/SECURITY.md
TECH/DATA-MODEL.md
TECH/DATABASE-MIGRATIONS.md
TECH/WORKTREES.md
TECH/DEPLOYMENT.md
TECH/TESTING.md
TECH/CHANGELOG.md
TECH/ADR/
```

## Regla documental

- Git/worktrees/release → Markdown del repositorio.
- API/contracts → Zod → OpenAPI → Scalar.
- No usar Scalar como reemplazo de la documentación operativa completa.
