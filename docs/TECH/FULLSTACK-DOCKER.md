# Full-stack Docker local

## Estado

**Decisión aceptada para el candidato `v0.2.0`; implementación pendiente.**

El compose actual `infra/docker-compose.dev.yml` levanta únicamente
dependencias de desarrollo. Se conserva.

El candidato integrado añadirá un `compose.yaml` en la raíz para levantar el
producto completo con un único comando.

## Por qué

Hoy un desarrollador necesita saber qué worktree contiene cada parte y abrir
varios procesos. Eso es válido para desarrollo, pero no para onboarding,
E2E o demostración de un release candidate.

La ejecución completa debe independizarse de los worktrees.

## Dos modos oficiales

### Modo 1 — híbrido para desarrollo

```text
Host:   irec-web / Angular dev server
Host:   irec-api / NestJS watch
Docker: PostgreSQL + Redis + Mailpit
```

Compose:

```text
infra/docker-compose.dev.yml
```

### Modo 2 — full-stack para candidato/release local

```text
Docker: irec-web
Docker: irec-api
Docker: irec-migrate
Docker: irec-postgres
Docker: irec-redis
Docker: irec-mailpit
```

Compose:

```text
compose.yaml
```

## Comando objetivo

```bash
docker compose up --build -d
```

Estado:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs -f
```

Detener sin borrar datos:

```bash
docker compose down
```

Reset destructivo local:

```bash
docker compose down -v
```

`down -v` debe documentarse siempre como destructivo porque elimina volúmenes
locales.

## Servicios

### `irec-postgres`

```text
image     postgres:17-alpine
internal  5432
host      15432
volume    irec-postgres-data
```

### `irec-redis`

```text
image     redis:8-alpine
internal  6379
host      6379
volume    irec-redis-data
```

### `irec-mailpit`

```text
SMTP      1025
UI        8025
```

### `irec-migrate`

Servicio one-shot construido con la imagen de API.

Debe:

1. esperar PostgreSQL healthy;
2. ejecutar migraciones Drizzle versionadas;
3. terminar con exit code 0;
4. bloquear el arranque de API si la migración falla.

No debe ejecutar `drizzle-kit push`.

### `irec-api`

Debe iniciar después de:

```text
irec-postgres healthy
irec-redis healthy
irec-migrate completed successfully
```

Dentro de Docker, las conexiones cambian de host a service-name:

```text
DATABASE_URL=postgresql://irec:irec_dev@irec-postgres:5432/irec
REDIS_URL=redis://irec-redis:6379
SMTP_HOST=irec-mailpit
SMTP_PORT=1025
```

El host continúa accediendo a:

```text
http://127.0.0.1:3000
```

### `irec-web`

Recomendación para el candidato: build Angular de producción + servidor web
ligero (por ejemplo Nginx) que sirva la SPA y proxyee `/api` hacia
`irec-api:3000`.

Host:

```text
http://127.0.0.1:4200
```

Esto evita depender del proxy de `ng serve` para el E2E del candidato.

## Red

Todos los servicios pertenecen a:

```text
irec-network
```

Los contenedores se comunican por nombre DNS de servicio; nunca mediante
`127.0.0.1` entre contenedores.

## Secretos locales

No versionar:

- `APP_ENCRYPTION_KEY`;
- private key JWT;
- credenciales reales;
- tokens de proveedores.

Se puede reutilizar el material generado por `scripts/init-local-env.ps1`,
pero el compose debe sobreescribir únicamente las URLs internas de DB/Redis/
SMTP necesarias dentro de Docker.

Regla:

> `docker compose up` nunca debe regenerar automáticamente RSA/AES si ya
> existen.

## Healthchecks

### API

```text
GET /api/health/live
GET /api/health/ready
```

### Web

Debe responder 200 en `/`.

### Dependencias

Postgres y Redis mantienen sus healthchecks actuales. Mailpit debe ser
alcanzable antes de ejecutar el E2E de email.

## Puertos oficiales locales

| Recurso | Host |
|---|---|
| Web | `127.0.0.1:4200` |
| API | `127.0.0.1:3000` |
| Scalar | `127.0.0.1:3000/reference` |
| OpenAPI | `127.0.0.1:3000/openapi.json` |
| Mailpit UI | `127.0.0.1:8025` |
| Mailpit SMTP | `127.0.0.1:1025` |
| PostgreSQL | `127.0.0.1:15432` |
| Redis | `127.0.0.1:6379` |

## Gate Docker

El gate pasa cuando desde `integration/v0.2.0` una persona puede hacer:

```bash
docker compose up --build -d
```

sin ejecutar manualmente `pnpm db:apply`, `pnpm dev:api` o `pnpm dev:web`, y
se cumplen:

```text
[ ] todos los contenedores esperados están healthy/running
[ ] migración termina correctamente
[ ] segundo arranque es idempotente
[ ] Web responde
[ ] API live responde
[ ] API ready responde
[ ] Scalar carga
[ ] Mailpit carga
[ ] registro por email llega a Mailpit
[ ] persistencia se conserva tras docker compose down/up
```

## Lo que Docker no cambia

Docker simplifica la ejecución, pero no reemplaza:

- Git branches/worktrees;
- OpenAPI/Scalar;
- gates;
- E2E;
- documentación;
- release/tagging.
