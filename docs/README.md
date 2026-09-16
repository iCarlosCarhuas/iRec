# iRec — Documentación del MVP

> Fuente de verdad del producto, decisiones y estado de implementación.

**Baseline publicado:** `v0.1.0`  
**Versión en desarrollo:** `v0.2.0 — Identity`  
**Última sincronización:** 2026-09-15  
**Estado:** Backend Identity validado; frontend y E2E pendientes.

## Estado rápido

| Área | Estado |
|---|---|
| v0.1.0 Foundation | ✅ Cerrado |
| v0.2.0 Identity — backend | ✅ Gate aprobado |
| v0.2.0 Identity — frontend | ⏳ Pendiente |
| v0.2.0 Identity — E2E | ⏳ Pendiente |
| Merge a `main` | ⏳ Pendiente |
| Tag `v0.2.0` | ⏳ Pendiente |

Ver [PROJECT-STATE.md](PROJECT-STATE.md) para el snapshot operativo.

## Objetivo

iRec es una PWA para crear y compartir álbumes digitales temáticos con:

- autenticación sin password tradicional mediante correo verificado + TOTP;
- access JWT RS256 en cookie HttpOnly;
- refresh token opaco rotativo con detección de reutilización;
- recuperación por correo y recovery codes;
- álbumes públicos o privados;
- visitantes públicos sin autenticación para contenido público;
- propuestas de contenido de invitados autenticados sujetas a moderación;
- fotos almacenadas en Cloudflare R2 aportado por cada creador;
- videos y transmisiones gestionados principalmente mediante YouTube;
- generación/ordenamiento temático asistido por IA;
- OpenAPI 3.1 generado desde contratos Zod;
- Scalar como referencia interactiva.

## Principios

1. **La documentación es parte del producto.**
2. **Contrato primero:** Zod define validación y contrato; OpenAPI se genera.
3. **No duplicar fuentes de verdad:** Scalar consume el OpenAPI generado.
4. **BYO Storage:** iRec no se convierte en custodio central de las fotos.
5. **Privacidad por defecto:** secretos nunca llegan al frontend en texto plano.
6. **Cambios trazables:** TECH y NONTECH changelogs acompañan cada versión.
7. **SemVer:** MAJOR.MINOR.PATCH.
8. **Naming:** todo recurso integrado nuevo usa `irec-<contexto>`.
9. **Migraciones versionadas:** no se usa `db:push` como flujo oficial.
10. **Un gate aprobado no implica release:** backend, frontend y E2E deben cerrar antes del tag.

## Índice

### Estado y alcance
- [Project State](PROJECT-STATE.md)
- [Product Scope](NONTECH/PRODUCT-SCOPE.md)
- [User Flows](NONTECH/USER-FLOWS.md)
- [Roadmap](NONTECH/ROADMAP.md)
- [Non-technical Changelog](NONTECH/CHANGELOG.md)

### Ingeniería
- [Architecture](TECH/ARCHITECTURE.md)
- [Security](TECH/SECURITY.md)
- [Data Model](TECH/DATA-MODEL.md)
- [Testing](TECH/TESTING.md)
- [Deployment](TECH/DEPLOYMENT.md)
- [Naming Conventions](TECH/NAMING-CONVENTIONS.md)
- [Database Migrations](TECH/DATABASE-MIGRATIONS.md)
- [Technical Changelog](TECH/CHANGELOG.md)

### Identity v0.2.0
- [Identity Backend](BACKEND/IDENTITY.md)
- [Auth API](API/AUTH.md)
- [Identity Plan](TECH/V020-IDENTITY-PLAN.md)
- [Backend Gate Evidence](TECH/V020-BACKEND-GATE.md)

### Planes
- [Frontend Plan](FRONTEND/PLAN.md)
- [Backend Plan](BACKEND/PLAN.md)
- [OpenAPI + Scalar](API/OPENAPI-SCALAR.md)
- [Versioning](VERSIONING.md)
- [ADRs](TECH/ADR/README.md)

## Regla de mantenimiento

Una feature no se considera cerrada si cambia comportamiento, arquitectura,
seguridad, API, DB o infraestructura y la documentación afectada no fue
actualizada.
