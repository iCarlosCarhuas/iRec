# iRec — Documentación del MVP

> Fuente de verdad de producto, arquitectura, decisiones, operación y releases.

**Baseline publicado:** `v0.1.0`  
**Versión en desarrollo:** `v0.2.0 — Identity`  
**Última sincronización:** 2026-09-16

## Estado rápido

| Área | Estado |
|---|---|
| `v0.1.0 Foundation` | ✅ Cerrado en `main` |
| `feat/backend` | ✅ Gate Identity backend |
| `feat/frontend` | ✅ Gate Identity frontend |
| `docs/project` | ✅ Documentación sincronizada |
| TOTP / HyperFrames | ✅ QA aprobado |
| `integration/v0.2.0` | ⏳ Por crear/integrar |
| Full-stack Docker | ⏳ Pendiente |
| E2E Identity | ⏳ Pendiente |
| Merge a `main` | ⏳ Pendiente |
| Tag `v0.2.0` | ⏳ Pendiente |

## Primero leer

- [Project State](PROJECT-STATE.md) — dónde estamos exactamente.
- [Worktrees](TECH/WORKTREES.md) — qué carpeta/rama cumple cada función.
- [Integración v0.2.0](TECH/INTEGRATION-V020.md) — cómo juntar las tres ramas sin tocar `main`.
- [Full-stack Docker](TECH/FULLSTACK-DOCKER.md) — cómo se levantará el producto completo.
- [Release checklist v0.2.0](TECH/RELEASE-V020-CHECKLIST.md) — secuencia hasta el tag.

## Producto

- [Product Scope](NONTECH/PRODUCT-SCOPE.md)
- [User Flows](NONTECH/USER-FLOWS.md)
- [Roadmap](NONTECH/ROADMAP.md)
- [Non-technical Changelog](NONTECH/CHANGELOG.md)

## Ingeniería

- [Architecture](TECH/ARCHITECTURE.md)
- [Security](TECH/SECURITY.md)
- [Data Model](TECH/DATA-MODEL.md)
- [Testing](TECH/TESTING.md)
- [Deployment](TECH/DEPLOYMENT.md)
- [Initialization](TECH/INITIALIZATION.md)
- [Naming Conventions](TECH/NAMING-CONVENTIONS.md)
- [Database Migrations](TECH/DATABASE-MIGRATIONS.md)
- [Technical Changelog](TECH/CHANGELOG.md)
- [Versioning](VERSIONING.md)
- [ADRs](TECH/ADR/README.md)

## Identity v0.2.0

- [Identity Backend](BACKEND/IDENTITY.md)
- [Auth API](API/AUTH.md)
- [Identity Plan](TECH/V020-IDENTITY-PLAN.md)
- [Backend Gate Evidence](TECH/V020-BACKEND-GATE.md)
- [Frontend Gate Evidence](TECH/V020-FRONTEND-GATE.md)
- [Frontend Plan](FRONTEND/PLAN.md)
- [TOTP Onboarding](FRONTEND/TOTP-ONBOARDING.md)

## API documentation

La cadena es:

```text
Zod → zod-openapi → OpenAPI 3.1 → Scalar
```

- Zod es la fuente de verdad de validación/contratos.
- OpenAPI es el documento generado.
- Scalar es el renderer interactivo disponible en `/reference`.
- Scalar no sustituye la documentación de Git, worktrees, Docker o releases.

Ver [OpenAPI + Scalar](API/OPENAPI-SCALAR.md).

## Regla de mantenimiento

Una feature no se considera cerrada si cambia comportamiento, arquitectura,
seguridad, API, DB, infraestructura o proceso de release y la documentación
afectada no fue actualizada.
