# iRec Infra — entorno local

Todos los recursos integrados siguen la convención:

```text
irec-<contexto>
```

## Recursos

| Recurso | Nombre | Puerto host |
|---|---|---:|
| Compose project | `irec-infra` | — |
| PostgreSQL | `irec-postgres` | `15432` |
| Redis | `irec-redis` | `6379` |
| Mailpit SMTP/UI | `irec-mailpit` | `1025` / `8025` |
| Network | `irec-network` | — |
| PostgreSQL volume | `irec-postgres-data` | — |
| Redis volume | `irec-redis-data` | — |

PostgreSQL conserva `5432` dentro del contenedor, pero iRec publica `15432`
en Windows para evitar colisiones con instalaciones locales de PostgreSQL.

La URL local oficial es:

```text
postgresql://irec:irec_dev@127.0.0.1:15432/irec
```

## Uso diario

```bash
pnpm dev:infra
pnpm dev:infra:ps
pnpm dev:infra:logs
pnpm dev:infra:down
```

`pnpm dev:infra` usa `docker compose up -d --wait`, por lo que espera los
healthchecks antes de devolver el control.

## PostgreSQL desde el contenedor

```bash
docker compose -f infra/docker-compose.dev.yml exec irec-postgres \
  pg_isready -U irec -d irec
```

Mailpit es exclusivamente local. Producción utilizará el proveedor de correo
configurado para iRec.
