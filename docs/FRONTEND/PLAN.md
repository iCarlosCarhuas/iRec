# Plan Frontend

## v0.2.0 Identity — estado

**Gate frontend: ✅ PASSED**

## Rutas implementadas

```text
/
├─ /auth
├─ /auth/verify-email
├─ /auth/totp/setup
├─ /auth/recovery-codes
├─ /auth/recover
└─ /settings/security
```

## Implementado

- login email + TOTP;
- alta por email;
- verificación de correo;
- enrolamiento TOTP;
- recovery codes;
- recovery por email;
- recovery por código;
- trusted devices;
- revoke individual/all;
- rotación TOTP;
- restauración de sesión;
- cookies HttpOnly gestionadas por backend;
- no uso de localStorage para access/refresh;
- proxy local `/api -> 127.0.0.1:3000`.

## TOTP onboarding

En `/auth/totp/setup`:

```text
instalar autenticador
→ +
→ escanear QR
→ código de 6 dígitos
→ Activar TOTP
→ recovery codes
```

Camino principal:
- Google Authenticator.

Alternativa:
- Microsoft Authenticator.

## HyperFrames

Tutorial animado embebido dentro de la misma ruta.

QA:

```text
Runtime   OK
Layout    OK
Motion    OK
Contrast  73/73 WCAG AA
```

## Gate siguiente

Frontend queda cerrado para esta fase.

Lo siguiente es **E2E Identity**, no Album Core.
