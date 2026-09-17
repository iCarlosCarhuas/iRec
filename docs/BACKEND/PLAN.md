# Plan Backend

## Estado por versión

### v0.2.0 Identity ✅ backend

Módulos implementados:

```text
src/
├─ auth/
├─ config/
├─ database/
├─ health/
├─ http/
├─ mail/
├─ openapi/
├─ redis/
└─ security/
```

Identity expone:

```text
POST   /auth/email/start
POST   /auth/email/verify
POST   /auth/totp/enroll
POST   /auth/totp/confirm
POST   /auth/login
GET    /auth/session
POST   /auth/refresh
POST   /auth/logout
POST   /auth/recovery/email
POST   /auth/recovery/email/verify
POST   /auth/recovery/code
POST   /auth/totp/rotate
POST   /auth/totp/rotate/confirm
GET    /auth/trusted-devices
DELETE /auth/trusted-devices/:deviceId
POST   /auth/trusted-devices/revoke-all
```

## Siguientes módulos

```text
albums/
memberships/
storage/
assets/
moderation/
themes/
youtube/
live/
notifications/
```

## Album Core v0.3.0

```text
GET    /albums
POST   /albums
GET    /albums/:albumId
PATCH  /albums/:albumId
DELETE /albums/:albumId
POST   /albums/:albumId/edit-mode
```

## Storage v0.4.0

```text
GET  /storage-connections
POST /storage-connections
POST /storage-connections/:id/test
POST /albums/:albumId/assets/presign-upload
```

## Moderation

```text
GET  /albums/:albumId/submissions
POST /albums/:albumId/submissions/:id/approve
POST /albums/:albumId/submissions/:id/reject
```

## AI v0.5.0

```text
POST /albums/:albumId/themes/generate
POST /albums/:albumId/themes/:themeId/apply
```

## YouTube v0.6.0

```text
GET  /integrations/youtube/connect
GET  /integrations/youtube/callback
POST /albums/:albumId/videos
POST /albums/:albumId/live
POST /albums/:albumId/live/:id/start
POST /albums/:albumId/live/:id/stop
```
