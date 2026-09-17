# iRec v0.3.0 — AD-2 Album API

## Objetivo

Exponer el primer API funcional de Album Core sobre el esquema introducido en AD-1.

## Endpoints

- `POST /api/albums`
- `GET /api/albums`
- `GET /api/albums/:albumId`
- `PATCH /api/albums/:albumId`

## Reglas

### Crear

Requiere `irec_access`.

La creación ocurre en una única transacción:

1. INSERT `albums`
2. INSERT `album_members` con `role=owner`, `status=active`

Si cualquiera falla, la transacción completa se revierte.

### Listar

Requiere sesión.

Devuelve álbumes donde el usuario:

- es `owner_id`; o
- posee una membresía `active`.

### Leer uno

- `public`: lectura anónima permitida.
- `private`: owner o miembro activo.
- un álbum privado no accesible responde 404 para no revelar su existencia.

### Actualizar

Requiere sesión y `owner_id === session.user.id`.

Los miembros no propietarios no pueden actualizar el álbum.

## Contratos

`packages/contracts/src/album.ts` sigue siendo la fuente compartida para:

- validación runtime
- tipos TypeScript
- OpenAPI

AD-2 agrega:

- `AlbumIdParamsSchema`
- `AlbumListResponseSchema`
- validación de patch no vacío

## Tests

Los tests AD-2 son deliberadamente puros y no modifican PostgreSQL.

Validan:

- `private` por defecto al crear
- patch vacío rechazado
- lectura pública anónima
- privacidad de álbum privado
- lectura de owner/miembro activo
- update exclusivo del owner

## Impacto de datos

AD-2 no cambia el esquema de PostgreSQL y no necesita una migración nueva.

Los endpoints sí crean o modifican filas cuando se usan de forma real. El gate de
source no inserta datos.

## Fuera de alcance

- invitar/remover miembros
- propuestas de contenido
- moderación
- fotos/R2
- IA
- YouTube
- UI Angular
- DELETE de álbum
