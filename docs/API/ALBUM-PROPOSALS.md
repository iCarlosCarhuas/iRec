# iRec v0.3.0 — AD-4 Proposals & Moderation

## Objetivo

Agregar el flujo colaborativo mínimo de Album Core:

1. un miembro activo propone contenido,
2. la propuesta nace `pending`,
3. el owner la revisa,
4. el owner la deja `approved` o `rejected`.

AD-4 no integra fotos todavía. El contenido de la propuesta es texto de hasta 2000
caracteres. En v0.4 las fotos/R2 podrán relacionarse con este flujo sin cambiar la
regla principal de moderación.

## Modelo

Nueva tabla:

`album_proposals`

Campos principales:

- `album_id`
- `proposed_by`
- `text`
- `status`
- `moderated_by`
- `moderated_at`
- timestamps

Estados:

- `pending`
- `approved`
- `rejected`

Las decisiones finales no se reescriben. Repetir la misma decisión es idempotente;
intentar cambiar `approved -> rejected` o `rejected -> approved` devuelve conflicto.

## Permisos

Crear propuesta:

- owner: no
- member active: sí
- invited: no
- removed: no
- outsider: no

Listar/moderar:

- owner: sí
- cualquier otro usuario: no

Una propuesta ya creada permanece aunque el miembro sea removido después. Esto
permite que el owner termine de revisar trabajo pendiente e histórico.

## Endpoints

- `POST /api/albums/:albumId/proposals`
- `GET /api/albums/:albumId/proposals`
- `POST /api/albums/:albumId/proposals/:proposalId/approve`
- `POST /api/albums/:albumId/proposals/:proposalId/reject`

## Migración

AD-4 cambia el esquema y requiere una migración Drizzle nueva.

El drop-in no incluye SQL escrito a mano. Después del SOURCE GATE:

1. crear backup local fresco,
2. verificar backup,
3. ejecutar `pnpm db:generate`,
4. revisar el SQL generado,
5. confirmar que sea únicamente aditivo,
6. aplicar con el servicio Docker `irec-migrate`.

Esperado en la migración:

- crear enum `album_proposal_status`
- crear tabla `album_proposals`
- crear foreign keys
- crear índices

No debe contener:

- DROP TABLE
- DROP COLUMN
- TRUNCATE
- DELETE
- cambios destructivos de Identity

## Fuera de alcance

- fotos/R2
- IA
- YouTube
- edición del contenido después de enviar
- comentarios de moderación
- transferencia de ownership
