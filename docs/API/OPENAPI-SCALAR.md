# OpenAPI con Zod + Scalar

## Qué hace cada pieza

```text
Zod schemas
   ↓ validación + metadata de contrato
zod-openapi
   ↓ generación
OpenAPI 3.1
   ↓ render
Scalar
```

### Zod

Fuente de verdad de validación y estructuras request/response compartidas.

### OpenAPI

Documento HTTP generado. iRec no mantiene un `openapi.yaml` manual paralelo.

### Scalar

Interfaz visual/interactiva del OpenAPI.

```text
GET /openapi.json
GET /reference
```

Cuando API está en `3000`:

```text
http://127.0.0.1:3000/openapi.json
http://127.0.0.1:3000/reference
```

## Qué NO debe vivir en Scalar

La guía completa de:

- clonado;
- worktrees;
- estrategia de ramas;
- Docker;
- release;
- troubleshooting de Git;

debe permanecer en la documentación del repositorio.

Scalar es documentación de API, no el manual operativo completo del proyecto.

## Quick Start dentro de Scalar

Después de implementar el compose full-stack, `info.description` puede incluir
un resumen corto como:

```text
iRec local quick start:
  docker compose up --build -d

Web:     http://127.0.0.1:4200
Scalar:  http://127.0.0.1:3000/reference
Mailpit: http://127.0.0.1:8025
```

No debe añadirse antes de que ese comando exista y pase su gate.

## Estado v0.2.0

El backend validado genera OpenAPI `3.1.0` con `18 paths` para Identity + Health.

En desarrollo la metadata reporta:

```text
version: 0.2.0-dev
```

Antes del tag debe pasar a `0.2.0`.

## Reglas contract-first

1. Request body/query/path/header tienen schema Zod cuando corresponde.
2. Responses relevantes tienen schema.
3. Cada operación tiene `operationId`.
4. Cada operación tiene tags.
5. Errores comunes usan Problem Details.
6. No documentar secretos reales en ejemplos.
7. No duplicar DTO/schema sin necesidad.
8. OpenAPI generado se valida en gate/CI.
9. Breaking changes requieren revisión SemVer.
10. Scalar nunca es fuente de verdad; es renderer del OpenAPI.
