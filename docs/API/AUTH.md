# Auth API — v0.2.0

Scalar es la referencia ejecutable. Este documento explica intención y flujo.

Base:

```text
/api/auth
```

## Registro / enrolamiento

```text
POST /api/auth/email/start
POST /api/auth/email/verify
POST /api/auth/totp/enroll
POST /api/auth/totp/confirm
```

`email/start` responde de forma anti-enumeración.

Tras `email/verify`, backend emite `irec_auth_flow` temporal.

`totp/confirm`:
- valida TOTP;
- activa credencial;
- devuelve los recovery codes una sola vez;
- emite access + refresh;
- opcionalmente trusted device.

## Login / sesión

```text
POST /api/auth/login
GET  /api/auth/session
POST /api/auth/refresh
POST /api/auth/logout
```

Cookies:

```text
irec_access     JWT RS256, 15 min
irec_refresh    token opaco rotativo, 12 h
irec_trusted    dispositivo confiable, hasta 30 días
irec_auth_flow  enrolamiento/recuperación, 15 min
```

Todas HttpOnly. Producción agrega `Secure`.

`GET /session` puede rotar refresh si el access no es utilizable.

## Recuperación

```text
POST /api/auth/recovery/email
POST /api/auth/recovery/email/verify
POST /api/auth/recovery/code
```

Después de una recuperación válida, el flujo vuelve al enrolamiento TOTP.

## Rotación TOTP

```text
POST /api/auth/totp/rotate
POST /api/auth/totp/rotate/confirm
```

La rotación:
- exige sesión;
- valida código actual;
- confirma secreto nuevo;
- invalida secreto anterior;
- regenera recovery codes;
- revoca trusted devices.

## Trusted devices

```text
GET    /api/auth/trusted-devices
DELETE /api/auth/trusted-devices/:deviceId
POST   /api/auth/trusted-devices/revoke-all
```

## Health

Fuera de `/auth`:

```text
GET /api/health/live
GET /api/health/ready
```

## Contrato

OpenAPI:

```text
GET /openapi.json
```

Scalar:

```text
GET /reference
```

El gate actual valida OpenAPI 3.1 con **18 paths**.
