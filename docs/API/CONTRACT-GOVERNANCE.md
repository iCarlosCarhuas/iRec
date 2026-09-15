# Gobierno del contrato API

## Fuente de verdad

```text
Zod schemas
   ↓
zod-openapi
   ↓
OpenAPI 3.1
   ↓
Scalar / generated clients / contract tests
```

## Breaking changes

Se consideran breaking:

- eliminar endpoint;
- cambiar método;
- renombrar/eliminar propiedad requerida;
- volver requerida una propiedad opcional;
- restringir enum sin compatibilidad;
- cambiar semántica de auth;
- cambiar status code esperado de forma incompatible.

## CI

Pipeline mínimo:

1. typecheck;
2. unit tests;
3. generar OpenAPI;
4. validar OpenAPI;
5. comparar contrato;
6. integration tests;
7. build.

## Review

Cambios de API requieren:
- schemas;
- tests;
- documentación;
- changelog TECH;
- changelog NONTECH si el comportamiento cambia.
