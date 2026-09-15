# ADR-0001 — Stack principal

**Estado:** Accepted  
**Fecha:** 2026-09-14

## Decisión

Angular para PWA y NestJS para API dentro de un monorepo TypeScript.

## Motivos

- ecosistema TypeScript compartido;
- estructura fuerte para un backend creciente;
- soporte PWA maduro;
- contratos compartibles;
- modularidad adecuada para auth, albums, R2, YouTube e IA.

## Consecuencia

Se prioriza consistencia y mantenibilidad sobre el mínimo número de dependencias.
