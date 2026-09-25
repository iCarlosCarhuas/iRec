# NONTECH Changelog

Cambios visibles para usuarios, producto, UX o alcance.

## [Unreleased]

## [0.3.0] - 2026-09-25

### Album Core

#### Added
- Los usuarios autenticados pueden crear y administrar múltiples álbumes.
- Cada álbum puede mantenerse privado o publicarse.
- El propietario puede invitar a otro usuario registrado al álbum.
- El invitado puede aceptar su participación y pasar a ser miembro activo.
- Los miembros pueden proponer contenido para el álbum.
- El propietario puede aprobar o rechazar esas propuestas.
- La interfaz muestra funciones distintas según el rol del usuario.
- Un álbum público puede compartirse mediante un enlace de solo lectura sin iniciar sesión.
- Un álbum privado no revela su contenido desde el enlace público.

#### Scope
- Este release cubre identidad + núcleo de álbumes.
- Fotos/R2, generación temática con IA, YouTube y transmisión en vivo permanecen fuera de v0.3.0.


## [0.2.0]

### Identity

#### Added
- Flujo definido e implementado en backend para registrarse sin contraseña.
- Verificación inicial de correo.
- Configuración de Google Authenticator u otra app TOTP mediante QR.
- Login con email + código TOTP.
- Opción de recordar un dispositivo hasta 30 días.
- Recuperación por correo.
- Recuperación alternativa mediante recovery code.
- Diez recovery codes de un solo uso tras activar/rotar TOTP.
- Pantalla de seguridad prevista para listar y revocar dispositivos confiables.
- Rotación de TOTP que invalida el secreto anterior.
- Guía paso a paso para instalar y configurar una app TOTP.
- Tutorial animado HyperFrames integrado dentro de `/auth/totp/setup`.
- Camino principal documentado con Google Authenticator.
- Alternativa documentada con Microsoft Authenticator.

#### Changed
- El usuario no gestiona contraseña tradicional.
- La recuperación de identidad permanece separada de Cloudflare R2.
- Identity backend y frontend forman parte de la release v0.2.0.

#### Status
- Backend: terminado y validado.
- Frontend: terminado y validado.
- Onboarding TOTP + HyperFrames: terminado y validado.
- `v0.2.0`: liberado y versionado.

## [0.1.0] - 2026-09-14

### Added
- Definido iRec como PWA de álbumes digitales temáticos.
- Cualquier usuario autenticado puede crear álbumes.
- Un usuario puede pertenecer a múltiples álbumes.
- Cada álbum puede ser público o privado.
- Los álbumes públicos pueden visualizarse sin autenticación.
- Solo el propietario controla la edición del álbum.
- Invitados autenticados pueden proponer contenido sujeto a moderación.
- Cloudflare R2 aportado por cada creador para fotos.
- YouTube como plataforma principal para video/live.
- Generación temática asistida por IA.
- TOTP como sustituto de contraseña tradicional.
- Dispositivo confiable por 30 días.
- Recuperación por correo y recovery codes.
- Sin expiración automática de álbumes.
- Borrado de recursos R2 al eliminar el álbum.
- Contenido YouTube se conserva salvo confirmación expresa.

### Removed
- Reconocimiento facial del MVP.
- Pagos del MVP.
- Multistream del MVP.
