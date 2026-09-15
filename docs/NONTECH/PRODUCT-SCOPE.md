# Alcance funcional — MVP

## Visión

Crear un entorno privado o público donde una persona pueda conservar, diseñar y compartir recuerdos multimedia sin depender de una galería rígida.

## Actores

### Usuario autenticado

Puede:

- crear múltiples álbumes;
- pertenecer a múltiples álbumes;
- configurar su almacenamiento;
- configurar su TOTP;
- activar dispositivo confiable por 30 días.

### Propietario del álbum

Puede:

- editar;
- configurar privacidad;
- conectar/reutilizar R2;
- subir fotos;
- moderar propuestas;
- definir o generar temática IA;
- conectar YouTube;
- gestionar videos y live;
- eliminar definitivamente el álbum.

### Invitado autenticado

Puede:

- visualizar álbum privado si fue invitado;
- proponer contenido;
- ver el estado de su propuesta.

No publica directamente en el álbum de otro usuario.

### Visitante público

Puede visualizar un álbum público sin autenticarse.

No puede editar ni administrar contenido.

## MVP incluido

- registro y verificación por email;
- TOTP;
- recuperación de cuenta;
- trusted device 30 días;
- creación de álbum;
- público/privado;
- modo edición;
- Cloudflare R2 BYO;
- carga y visualización de fotos;
- moderación;
- YouTube OAuth;
- uploads de video hacia YouTube;
- YouTube Live;
- video resultante del live;
- embeds;
- IA para análisis/tema/orden;
- PWA mobile-first;
- comentarios/chat asociados a YouTube cuando aplique.

## Fuera de MVP

- pagos;
- reconocimiento facial;
- aplicación móvil nativa;
- editor avanzado de video;
- streaming simultáneo multired;
- marketplace;
- expiración automática de álbum;
- panel global de superadministrador.

## Definición de éxito

El MVP está listo para usuarios reales cuando un usuario nuevo puede, sin asistencia del desarrollador:

1. validar correo;
2. configurar TOTP;
3. crear álbum;
4. conectar R2;
5. subir fotos;
6. generar un tema;
7. publicar o compartir el álbum;
8. moderar aportes;
9. conectar YouTube;
10. crear o embeber video/live.
