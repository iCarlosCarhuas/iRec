# Despliegue

## Entornos

- local
- staging
- production

## Servicios

- Web Angular: CDN/edge hosting.
- API NestJS: contenedor.
- PostgreSQL administrado.
- Redis administrado.
- Media gateway separado.
- R2 pertenece a cada usuario final.

## Variables sensibles

Nunca se versionan:

- DB URL;
- Redis URL;
- cookie/session keys;
- master encryption key;
- email credentials;
- Google OAuth client secret;
- AI provider key.

## Health checks

- `/health/live`
- `/health/ready`

`ready` comprueba dependencias internas críticas, pero no debe depender de R2 de usuarios individuales.

## Migraciones

- migraciones versionadas;
- ejecutadas antes de tráfico nuevo;
- nunca modificar una migración ya aplicada en producción.
