# ADR-0011 — Migraciones SQL versionadas

**Estado:** Accepted  
**Objetivo:** v0.2.0

## Decisión

iRec usa:

```text
drizzle-kit generate
+
drizzle-orm migrator
```

Las migraciones bajo `apps/api/drizzle/` se versionan.

`drizzle-kit push` no es el mecanismo oficial.

## Motivo

- reproducibilidad;
- auditabilidad;
- CI/CD;
- errores de ejecución visibles;
- historial de esquema explícito.
