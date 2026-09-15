# iRec

> Álbumes digitales temáticos para conservar, organizar y compartir recuerdos.

iRec es una PWA orientada a la creación de álbumes digitales privados o públicos, donde cada usuario mantiene control sobre su contenido y almacenamiento.

El proyecto combina autenticación passwordless mediante TOTP, almacenamiento BYO con Cloudflare R2, generación temática asistida por IA e integración con YouTube para video y transmisiones en vivo.

---

## Estado del proyecto

**Versión actual:** `v0.1.0 — Foundation`

iRec se encuentra actualmente en fase MVP.

La versión `v0.1.0` establece:

- monorepo con pnpm;
- Angular PWA;
- API NestJS;
- contratos compartidos con Zod;
- OpenAPI 3.1 mediante `zod-openapi`;
- documentación interactiva con Scalar;
- infraestructura local para PostgreSQL y Redis;
- documentación técnica y funcional versionada;
- estrategia Git Worktrees.

---

## Visión

iRec busca resolver un problema simple:

> Los recuerdos digitales suelen terminar dispersos entre dispositivos, servicios de almacenamiento, redes sociales y aplicaciones de mensajería.

iRec permite centralizar la experiencia del álbum sin obligar al usuario a entregar la propiedad de sus archivos a la plataforma.

Cada creador puede conectar su propio almacenamiento Cloudflare R2 y utilizar iRec como capa de experiencia, organización y presentación.

---

## Funcionalidades previstas

### Identidad

- registro mediante correo electrónico;
- verificación de email;
- autenticación mediante TOTP;
- Google Authenticator compatible;
- sin contraseña tradicional;
- recovery codes;
- recuperación mediante correo;
- dispositivos confiables durante 30 días.

### Álbumes

- creación de múltiples álbumes;
- álbumes públicos o privados;
- múltiples álbumes por usuario;
- propietario e invitados;
- modo edición;
- moderación de contenido enviado por invitados.

### Fotografías

- almacenamiento en Cloudflare R2;
- modelo BYO Storage;
- subida mediante URLs prefirmadas;
- thumbnails;
- organización por álbum.

### Inteligencia artificial

La IA podrá analizar las fotografías y generar una propuesta temática basada en:

- contenido visual;
- fechas;
- composición;
- colores;
- orden cronológico;
- instrucciones del propietario.

La IA no genera código ejecutable arbitrario.

Genera un:

```text
ThemeManifest
