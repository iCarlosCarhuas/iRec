# Plan Backend

## Módulos NestJS

```text
src/modules/
├─ auth/
├─ users/
├─ albums/
├─ memberships/
├─ storage/
├─ assets/
├─ moderation/
├─ themes/
├─ youtube/
├─ live/
├─ notifications/
└─ health/
```

## Capas

- controller/transport;
- application/use cases;
- domain;
- infrastructure.

No es obligatorio aplicar DDD ceremonial; los límites deben impedir acoplar YouTube/R2 directamente a controllers.

## Auth

Endpoints previstos:

```text
POST /auth/email/start
POST /auth/email/verify
POST /auth/totp/enroll
POST /auth/totp/confirm
POST /auth/login
POST /auth/recovery/email
POST /auth/recovery/code
POST /auth/totp/rotate
POST /auth/logout
```

## Albums

```text
GET    /albums
POST   /albums
GET    /albums/:albumId
PATCH  /albums/:albumId
DELETE /albums/:albumId
POST   /albums/:albumId/edit-mode
```

## Storage

```text
GET    /storage-connections
POST   /storage-connections
POST   /storage-connections/:id/test
POST   /albums/:albumId/assets/presign-upload
```

## Moderation

```text
GET  /albums/:albumId/submissions
POST /albums/:albumId/submissions/:id/approve
POST /albums/:albumId/submissions/:id/reject
```

## IA

```text
POST /albums/:albumId/themes/generate
POST /albums/:albumId/themes/:themeId/apply
```

## YouTube

```text
GET  /integrations/youtube/connect
GET  /integrations/youtube/callback
POST /albums/:albumId/videos
POST /albums/:albumId/live
POST /albums/:albumId/live/:id/start
POST /albums/:albumId/live/:id/stop
```

Los nombres finales quedan sujetos a la primera implementación contractual.
