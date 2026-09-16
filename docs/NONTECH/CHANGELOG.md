# NONTECH Changelog

Cambios visibles para usuarios, producto, UX o alcance.

## [Unreleased]

### v0.2.0 — Identity (en integración)

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
- Identity backend está validado; las pantallas frontend todavía no forman
  parte de una release pública.

#### Status
- Backend: terminado y validado.
- Frontend: terminado y validado.
- Onboarding TOTP + HyperFrames: terminado y validado.
- E2E: pendiente.
- `v0.2.0`: todavía no liberado.

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
