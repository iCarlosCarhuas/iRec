# OpenAPI + Scalar

## Cadena de documentación API

```text
Zod schemas
   ↓
zod-openapi
   ↓
OpenAPI 3.1
   ↓
Scalar
```

Zod es la fuente de verdad de los contratos. No se mantiene un
`openapi.yaml` manual.

## URLs

```text
OpenAPI  http://127.0.0.1:3000/openapi.json
Scalar   http://127.0.0.1:3000/reference
```

## Quick Start dentro de Scalar

`info.description` incluye un resumen operativo del full-stack Docker:

```text
setup de .env.docker
docker compose up --build -d
Web/API/Mailpit
```

Ese resumen no reemplaza la documentación de Git/worktrees/release.

La guía completa sigue en:

```text
docs/GETTING-STARTED.md
docs/TECH/FULLSTACK-DOCKER.md
docs/TECH/INTEGRATION-V020.md
```

## Reglas

- endpoints y schemas: código/Zod;
- OpenAPI: generado;
- UI API: Scalar;
- onboarding del repositorio: Markdown versionado;
- no duplicar contratos manualmente en YAML.
