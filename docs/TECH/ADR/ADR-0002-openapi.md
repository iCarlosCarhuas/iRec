# ADR-0002 — Zod/OpenAPI como contrato

**Estado:** Accepted  
**Fecha:** 2026-09-14

## Decisión

Los schemas Zod serán la fuente de validación y metadatos. `zod-openapi` generará OpenAPI 3.1. Scalar renderizará ese documento.

## Regla

No mantener manualmente un `openapi.yaml` paralelo al código.

## Consecuencia

Cambiar request/response exige cambiar schema y tests; `/openapi.json` se regenera automáticamente.
