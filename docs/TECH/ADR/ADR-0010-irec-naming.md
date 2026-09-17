# ADR-0010 — Convención global `irec-*`

**Estado:** Accepted  
**Objetivo:** v0.2.0

## Decisión

Todo recurso técnico integrado por iRec usa:

```text
irec-<contexto>
```

Docker actual:

```text
irec-infra
irec-postgres
irec-redis
irec-mailpit
irec-network
```

## Motivo

Evita colisiones y permite identificar recursos del proyecto fuera del
repositorio, especialmente en Docker Desktop, CI/CD y observabilidad.
