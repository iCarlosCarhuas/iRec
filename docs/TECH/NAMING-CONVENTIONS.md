# Convención de nombres iRec

**Estado:** Accepted  
**Desde:** `v0.2.0`

Todo recurso técnico creado o integrado por el proyecto usa:

```text
irec-<contexto>
```

## Actuales

```text
irec-infra
irec-postgres
irec-redis
irec-mailpit
irec-network
irec-postgres-data
irec-redis-data
```

## Futuros

```text
irec-api
irec-web
irec-worker
irec-media
irec-gateway
irec-storage
```

Los paquetes npm conservan namespace:

```text
@irec/api
@irec/web
@irec/contracts
```

## Regla

No introducir recursos globales ambiguos como `app`, `backend`, `infra`,
`postgres`, `redis` o `service` cuando iRec pueda nombrarlos explícitamente.

En ambientes desplegados se permite sufijo:

```text
irec-api-staging
irec-api-production
```
