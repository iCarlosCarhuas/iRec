# NONTECH Changelog

Cambios visibles para usuarios, producto, UX o alcance.

## [Unreleased]

### Added
- Pendiente de próximas iteraciones.

## [0.1.0] - 2026-09-14

### Added
- Disponible una primera PWA de fundacion para validar el entorno antes de implementar flujos de usuario.
- El roadmap queda visible desde la pantalla inicial de desarrollo.
- Definido iRec como PWA de álbumes digitales temáticos.
- Cualquier usuario autenticado puede crear álbumes.
- Un usuario puede pertenecer a múltiples álbumes.
- Cada álbum puede ser público o privado.
- Los álbumes públicos pueden visualizarse sin autenticación.
- Solo el propietario controla la edición del álbum.
- Invitados autenticados pueden proponer contenido sujeto a moderación.
- Se define Cloudflare R2 aportado por cada creador para fotos.
- Se define YouTube como plataforma principal para video/live.
- Se define generación temática asistida por IA.
- Se define TOTP como sustituto de contraseña tradicional.
- Se define opción de dispositivo confiable por 30 días.
- Se define recuperación por correo y recovery codes.
- Se descarta expiración automática de álbumes.
- Se define borrado definitivo de recursos R2 al eliminar el álbum.
- Se mantiene contenido YouTube salvo confirmación expresa de borrado externo.

### Changed
- El secreto TOTP no se enviará por correo; se enrola mediante QR.
- R2 se usará principalmente para imágenes y assets del álbum, no como solución primaria de video.
- Comentarios asociados a live/video podrán apoyarse en YouTube.

### Removed
- Reconocimiento facial del alcance MVP.
- Pagos del alcance MVP.
- Multistream del alcance MVP.
