# Deployment / ejecución local

## Alcance actual

`v0.2.0` implementa **full-stack Docker local para integración, E2E y demo**.
No representa todavía una arquitectura de producción pública.

## Modo full-stack

```bash
docker compose up --build -d
```

Servicios:

```text
irec-web       Angular + Nginx
irec-api       NestJS
irec-migrate   Drizzle one-shot
irec-postgres  PostgreSQL 17
irec-redis     Redis 8
irec-mailpit   SMTP local
```

La red interna es `irec-fullstack-network`.

## Modo híbrido de desarrollo

Se conserva:

```text
infra/docker-compose.dev.yml
```

En este modo PostgreSQL/Redis/Mailpit están en Docker, mientras API/Web se
ejecutan en host con watch/hot reload.

No ejecutar ambos modos al mismo tiempo.

## Variables

Host/híbrido:

```text
.env
```

Full-stack:

```text
.env.docker
```

`.env.docker` nunca entra a Git. `.env.docker.example` sí.

## Producción futura

Antes de un despliegue real deberán separarse, entre otros:

- secretos gestionados externamente;
- TLS y `COOKIE_SECURE=true`;
- base de datos administrada o persistencia definida;
- Redis administrado/persistente según estrategia;
- Resend en lugar de Mailpit;
- imágenes con estrategia de registry/tagging;
- observabilidad;
- backup/restore;
- política de migraciones y rollback.

Estas tareas no bloquean el gate local de `v0.2.0`.
