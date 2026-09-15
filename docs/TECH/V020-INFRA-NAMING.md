# v0.2.0 — Migración de naming de infraestructura

Durante Identity se adoptó la convención global `irec-*`.

## Cambio

Antes:

```text
infra-postgres-1
infra-redis-1
infra-mailpit-1
infra_default
infra_irec_postgres
infra_irec_redis
```

Después:

```text
irec-infra
irec-postgres
irec-redis
irec-mailpit
irec-network
irec-postgres-data
irec-redis-data
```

## Motivo

- evitar colisiones con otros proyectos;
- hacer identificables los recursos desde Docker Desktop/CLI;
- mantener consistencia futura con API, web, workers y media;
- facilitar observabilidad y operación.
