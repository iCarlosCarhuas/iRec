# Plan técnico v0.2.0 — Identity

## Gate 1 — backend ✅ PASSED

Validado el 2026-09-15.

## Gate 2 — frontend ✅ PASSED

Validado el 2026-09-15.

Incluye:

- auth/login;
- email verify;
- TOTP setup;
- recovery codes;
- recovery;
- security settings;
- trusted devices;
- TOTP rotation;
- HyperFrames onboarding inline.

## Gate 2.1 — HyperFrames ✅ PASSED

```text
Runtime   OK
Layout    OK
Motion    OK
Contrast  73/73 WCAG AA
```

La advertencia `timeline_track_too_dense` queda aceptada como deuda menor de
mantenibilidad mientras el tutorial siga siendo pequeño.

## Gate 3 — E2E ⏳

```text
email
→ verificación
→ TOTP
→ recovery codes
→ logout
→ login
→ remember device
→ session restore
→ refresh rotation
→ revoke trusted device
→ recovery
→ rotate TOTP
→ TOTP anterior inválido
```

## Gate 4 — release ⏳

1. completar E2E;
2. merge backend;
3. merge frontend;
4. merge docs;
5. gate desde `main`;
6. changelogs finales;
7. tag `v0.2.0`;
8. GitHub release.
