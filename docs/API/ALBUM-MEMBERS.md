# iRec v0.3.0 — AD-3 Membership & Permissions

## Objetivo

Habilitar membresías reales sobre `album_members` sin agregar tablas nuevas.

AD-3 usa los estados creados en AD-1:

- `invited`
- `active`
- `removed`

y conserva `owner` como rol protegido.

## Endpoints

- `GET /api/albums/:albumId/members`
- `POST /api/albums/:albumId/members/invite`
- `POST /api/albums/:albumId/members/accept`
- `DELETE /api/albums/:albumId/members/:userId`

Todos requieren sesión.

## Flujo de invitación

1. Owner invita un correo.
2. El correo debe pertenecer a una cuenta iRec verificada.
3. Se crea o reactiva la fila `album_members` como:
   - role = `member`
   - status = `invited`
4. El usuario invitado acepta con su propia sesión.
5. La membresía cambia a:
   - status = `active`
   - joined_at = now()

La combinación `(album_id, user_id)` ya es PK compuesta, por lo que no se crean
membresías duplicadas.

## Permisos

### Ver miembros

Permitido para:

- owner
- miembro `active`

No permitido para:

- invitado pendiente
- miembro `removed`
- usuario externo

### Gestionar miembros

Solo owner puede:

- invitar
- remover

El owner nunca puede remover su propia membresía.

### Remoción

`DELETE` no elimina físicamente la fila. Cambia:

`status -> removed`

Esto conserva historial y permite una futura reinvitación sin alterar el esquema.

## Relación con AD-2

`AlbumService.getById()` ya considera únicamente membresías `active` para leer un
álbum privado.

Por eso:

- `invited` no obtiene acceso privado
- `active` sí obtiene acceso
- `removed` pierde acceso inmediatamente

## Alcance MVP

AD-3 invita únicamente cuentas iRec ya registradas y verificadas.

Las invitaciones a correos que todavía no tienen cuenta quedan fuera de v0.3.0
y requerirían un modelo separado de invitaciones por email.

## Impacto de datos

No hay migración nueva.

El source gate no modifica PostgreSQL.

Los endpoints de invite/accept/remove sí cambian filas de `album_members` cuando
se ejecutan en runtime.

## Fuera de alcance

- permisos granulares por recurso
- co-owner
- transferencia de propiedad
- invitaciones a correos no registrados
- moderación de propuestas
- fotos / R2
- IA
- YouTube
