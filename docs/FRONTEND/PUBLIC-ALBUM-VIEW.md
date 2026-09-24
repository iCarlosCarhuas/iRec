# iRec v0.3.0 — Public Album View

AD-6 añade la primera superficie compartible de un álbum iRec.

## Ruta

`/a/:albumId`

La ruta no usa `authGuard`. Un visitante anónimo puede abrirla cuando el álbum es `public`.

## Reglas

- Álbum `public`: se muestra título, descripción y una superficie pública de solo lectura.
- Álbum `private`: la página pública muestra un estado genérico de “no disponible”, incluso si el navegador tiene una sesión owner/member.
- Error/404: usa el mismo estado genérico para no revelar la existencia de álbumes privados.
- No se muestran miembros, correos, propuestas ni controles administrativos.
- Un usuario autenticado puede saltar desde la vista pública a `/albums/:albumId`.
- El workspace del álbum expone “Vista pública” y “Copiar enlace” cuando la visibilidad es pública.

## Alcance v0.3

Esta vista publica metadatos del álbum. Photos/R2 llega en v0.4; cuando exista contenido multimedia, esta ruta será su superficie de lectura anónima.

## Fuera de alcance

- Fotos/videos reales.
- Tema generado por IA.
- Open Graph dinámico por álbum.
- Slugs personalizados.
- Password/PIN para álbum privado.
