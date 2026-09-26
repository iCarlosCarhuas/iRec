# Plan Backend

## Estado por versión

### v0.1.0 — Foundation ✅

Base de monorepo, contratos, infraestructura local y documentación inicial.

### v0.2.0 — Identity ✅

Implementado y liberado:

```text
src/auth/
src/config/
src/database/
src/health/
src/http/
src/mail/
src/openapi/
src/redis/
src/security/
```

Incluye email verificado, TOTP, recovery codes, trusted devices, JWT RS256,
refresh opaco rotativo, PostgreSQL, Redis y OpenAPI/Scalar.

### v0.3.0 — Album Core ✅

Backend liberado con:

```text
POST   /api/albums
GET    /api/albums
GET    /api/albums/:albumId
PATCH  /api/albums/:albumId

GET     /api/albums/:albumId/members
POST    /api/albums/:albumId/members/invite
POST    /api/albums/:albumId/members/accept
DELETE  /api/albums/:albumId/members/:userId

POST /api/albums/:albumId/proposals
GET  /api/albums/:albumId/proposals
POST /api/albums/:albumId/proposals/:proposalId/approve
POST /api/albums/:albumId/proposals/:proposalId/reject
```

No asumir endpoints históricos que no estén presentes en el código real.

## v0.4.0 — R2 + Photos ⏭

La release se divide en iteraciones pequeñas:

```text
R2-0  Foundation / architecture / static gate ✅
R2-1  StorageConnection domain + encryption 🚧
R2-2  R2 validation API
R2-3  Photo asset domain + migration
R2-4  Presigned upload + completion validation
R2-5  Listing/read/delete + moderation
R2-6  Angular integration + public rendering
R2-7  E2E + hardening + release gate
```

### Dirección API conceptual

Las rutas finales se congelan con contratos y controllers reales en cada
iteración. El diseño parte de estas responsabilidades:

```text
/storage-connections
  list own connections
  create/update connection metadata securely
  validate/test connection

/albums/:albumId
  associate/detach an allowed storage connection

/albums/:albumId/assets
  reserve/presign upload
  confirm upload
  list/read
  delete owner-controlled assets
  moderate pending member assets
```

R2-1 tampoco expone todavía creación HTTP de conexiones. Prepara contratos,
persistencia cifrada y ownership. R2-2 agrega validación real de Cloudflare y
recién entonces el controller público correspondiente.

## v0.5.0 — AI Theme

Theme generation permanece fuera de v0.4.0.

## v0.6.0 — YouTube + Live

YouTube/video/live permanecen fuera de v0.4.0.

## Reglas de implementación

- contracts/API antes de UI cuando sea posible;
- authorization explícita y testeable;
- migraciones aditivas y revisadas antes de apply;
- backup + verify antes de cambios DB significativos;
- no secrets en frontend/logs/Git;
- no mezclar `album_proposals` de texto con `album_assets`;
- no introducir funcionalidades de v0.5/v0.6 dentro de R2.
