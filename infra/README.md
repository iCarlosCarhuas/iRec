# iRec Infra — entorno local híbrido

Este directorio contiene únicamente la infraestructura usada cuando API/Web se
ejecutan en el host con hot reload.

```text
infra/docker-compose.dev.yml
```

Recursos:

| Recurso | Nombre | Puerto host |
|---|---|---:|
| Compose project | `irec-infra` | — |
| PostgreSQL | `irec-postgres` | `15432` |
| Redis | `irec-redis` | `6379` |
| Mailpit SMTP/UI | `irec-mailpit` | `1025` / `8025` |
| Network | `irec-network` | — |
| PostgreSQL volume | `irec-postgres-data` | — |
| Redis volume | `irec-redis-data` | — |

Uso:

```bash
pnpm dev:infra
pnpm dev:infra:ps
pnpm dev:infra:logs
pnpm dev:infra:down
```

PostgreSQL host:

```text
postgresql://irec:irec_dev@127.0.0.1:15432/irec
```

## No confundir con full-stack

El release candidate completo usa:

```text
compose.yaml
```

en la raíz y levanta también `irec-api`, `irec-web` e `irec-migrate`.

No ejecutar ambos compose al mismo tiempo. Antes de pasar a full-stack:

```bash
pnpm dev:infra:down
```

Ver `docs/TECH/FULLSTACK-DOCKER.md`.
