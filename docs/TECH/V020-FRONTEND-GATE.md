# v0.2.0 — Evidencia del gate frontend Identity

**Fecha:** 2026-09-15  
**Rama:** `feat/frontend`  
**Resultado:** PASSED

## Resultado final

```text
iRec v0.2.0 IDENTITY FRONTEND PASSED
Web: http://127.0.0.1:4200
API proxy: /api -> http://127.0.0.1:3000
```

## Checks

```text
@irec/contracts build      OK
@irec/contracts typecheck  OK
@irec/web typecheck        OK
Angular build              OK
backend health             OK
web /                      OK
web /auth                  OK
web /auth/recover          OK
web /settings/security     OK
proxy /api/health/live     OK
```

## Build

Angular generó:

- main bundle;
- styles;
- lazy chunks para Identity;
- rutas lazy para security/auth/recovery/TOTP/recovery codes.

## Correcciones aplicadas durante el gate

- Angular host fijado a `127.0.0.1:4200` para evitar bind exclusivo a `::1`.
- validación de botones TOTP movida desde regex en template a TypeScript.
- API backend reutilizable sin levantar un segundo proceso en `:3000`.
- onboarding TOTP integrado.
- tutorial HyperFrames embebido en la misma ruta.

## HyperFrames

```text
[OK] iRec TOTP HyperFrames QA PASSED
```

Contraste:

```text
73/73 text checks pass WCAG AA
```

## Gate siguiente

Este resultado **no cierra v0.2.0**.

Falta E2E funcional Identity.
