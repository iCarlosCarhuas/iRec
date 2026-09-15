# Roadmap

## 0.1.0 — Foundation ✅

- documentación inicial;
- arquitectura;
- contratos;
- monorepo;
- entorno local;
- OpenAPI + Scalar;
- release/tag.

## 0.2.0 — Identity 🚧

### Backend ✅
- email verification;
- TOTP;
- recovery codes;
- trusted devices;
- JWT RS256;
- refresh rotation/reuse detection;
- rate limiting;
- PostgreSQL/Drizzle;
- Redis;
- Mailpit;
- OpenAPI;
- backend gate.

### Frontend ⏳
- `/auth`;
- verificación de email;
- TOTP setup;
- recovery codes;
- recovery;
- security settings;
- integración de cookies/sesión.

### E2E ⏳
- alta completa;
- logout/login;
- remember device;
- restore session;
- revoke trusted device;
- recovery;
- rotate TOTP;
- validación de que el TOTP anterior deja de servir.

**Regla:** no crear tag `v0.2.0` hasta cerrar frontend + E2E + integración a `main`.

## 0.3.0 — Album Core

- dashboard;
- CRUD de álbum;
- público/privado;
- modo edición;
- membresías.

## 0.4.0 — R2 & Photos

- conexiones R2;
- cifrado de credenciales;
- test de conexión;
- presigned upload;
- gallery;
- thumbnails;
- moderación.

## 0.5.0 — AI Theme

- análisis;
- orden;
- ThemeManifest;
- preview;
- regeneración.

## 0.6.0 — YouTube

- OAuth;
- upload de video;
- embed;
- live;
- chat;
- post-live recording.

## 0.7.0 — Hardening

- E2E global;
- security audit;
- backups;
- observabilidad;
- UX de errores;
- PWA offline shell.

## 1.0.0 — MVP público

Release inicial para usuarios reales.
