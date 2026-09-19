# iRec v0.3.0 — AD-5 Album UI

AD-5 convierte Album Core en una experiencia utilizable desde la PWA sin cambiar
el esquema de PostgreSQL ni los contratos HTTP del backend.

## Rutas

- `/albums` — listado de albumes del usuario y creacion.
- `/albums/:albumId` — detalle del album, miembros y colaboracion.
- `/albums/:albumId/join` — aceptacion de una invitacion existente.

Todas las rutas de AD-5 requieren sesion mediante `authGuard`.
La vista publica anonima se implementara en el siguiente bloque y no se simula en
esta entrega.

## Owner

El propietario puede:

- crear albumes;
- cambiar titulo, descripcion y visibilidad;
- ver la lista de miembros;
- invitar una cuenta iRec ya verificada;
- copiar un enlace de aceptacion para la persona invitada;
- remover miembros (soft removal en backend);
- revisar propuestas;
- aprobar o rechazar propuestas pendientes.

## Member

Un miembro activo puede:

- abrir los albumes a los que pertenece;
- ver el roster de miembros;
- enviar propuestas de texto al owner.

Un usuario invitado puede abrir `/albums/:albumId/join` y aceptar su invitacion.
El enlace no contiene credenciales ni tokens: el backend valida que la cuenta
actual tenga realmente una membresia `invited` para ese album.

## Propuestas

En v0.3 una propuesta contiene texto. AD-5 no intenta simular Photos/R2. El panel
explica esta limitacion para que v0.4 pueda incorporar contenido multimedia sobre
el flujo de moderacion existente.

## Estados de interfaz

Las pantallas contemplan estados de carga, vacio y error. Los errores HTTP pasan
por `uiError` para mantener el mismo lenguaje de Identity.

## Seguridad

- Se reutiliza `AuthStore`, `authGuard` y las cookies HttpOnly existentes.
- No se persisten JWT, IDs sensibles ni sesiones en localStorage/sessionStorage.
- Las llamadas de Album API usan `withCredentials: true`.
- El frontend no decide permisos como fuente de verdad: solo adapta la interfaz;
  el backend sigue validando owner, active member, invited y removed.

## Fuera de alcance

- vista publica anonima final;
- fotos/R2;
- AI Theme;
- YouTube/Live;
- comentarios de moderacion;
- invitaciones por correo a usuarios no registrados.
