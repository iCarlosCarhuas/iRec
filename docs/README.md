# iRec — Documentación del MVP

> Fuente de verdad del producto y de la implementación.

**Versión documental inicial:** `0.1.0`  
**Fecha:** 2026-09-14  
**Estado:** Planning / MVP foundation

## Objetivo

iRec es una PWA para crear y compartir álbumes digitales temáticos con:

- acceso sin contraseña mediante correo verificado + TOTP;
- álbumes públicos o privados;
- modo edición protegido adicionalmente por código;
- fotografías almacenadas en Cloudflare R2 aportado por cada creador (BYO Storage);
- videos y transmisiones gestionados mediante YouTube;
- moderación del contenido propuesto por invitados;
- generación y ordenamiento temático asistido por IA;
- documentación API OpenAPI 3.1 generada desde Zod mediante `zod-openapi`;
- referencia interactiva de API con Scalar.

## Principios

1. **La documentación es parte del producto.**
2. **Contrato primero:** Zod define validación y contrato; OpenAPI se genera desde esos esquemas.
3. **No duplicar fuentes de verdad:** la referencia Scalar consume el OpenAPI generado por backend.
4. **BYO Storage:** iRec no se convierte en custodio central de las fotos.
5. **Privacidad por defecto:** secretos, TOTP, tokens OAuth y credenciales R2 nunca llegan al frontend en texto plano.
6. **Cambios trazables:** todo cambio relevante debe reflejarse en `TECH/CHANGELOG.md` y/o `NONTECH/CHANGELOG.md`.
7. **SemVer:** las versiones del producto siguen MAJOR.MINOR.PATCH.

## Índice

- [Product Scope](NONTECH/PRODUCT-SCOPE.md)
- [User Flows](NONTECH/USER-FLOWS.md)
- [Roadmap](NONTECH/ROADMAP.md)
- [Non-technical Changelog](NONTECH/CHANGELOG.md)
- [System Architecture](TECH/ARCHITECTURE.md)
- [Security](TECH/SECURITY.md)
- [Data Model](TECH/DATA-MODEL.md)
- [Technical Changelog](TECH/CHANGELOG.md)
- [Frontend Plan](FRONTEND/PLAN.md)
- [Backend Plan](BACKEND/PLAN.md)
- [OpenAPI + Scalar](API/OPENAPI-SCALAR.md)
- [Versioning](VERSIONING.md)
- [Testing](TECH/TESTING.md)
- [Deployment](TECH/DEPLOYMENT.md)
- [ADRs](TECH/ADR/README.md)

## Regla de mantenimiento

Ninguna feature se considera terminada si cambia el comportamiento o arquitectura y no actualiza la documentación correspondiente.

- [Inicializacion del repositorio](TECH/INITIALIZATION.md)

- [Estrategia Git Worktrees](TECH/WORKTREES.md)
