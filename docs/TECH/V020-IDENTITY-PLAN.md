# Plan técnico v0.2.0 — Identity

## Gate 1 — backend ✅ PASSED

Validado el 2026-09-15.

- contratos Zod;
- OpenAPI/Scalar;
- PostgreSQL + Drizzle;
- migraciones versionadas;
- Redis;
- Mailpit/Resend adapter;
- JWT RS256;
- refresh rotation/reuse detection;
- TOTP;
- bcrypt recovery codes;
- trusted devices;
- rate limiting;
- backend verification script;
- naming `irec-*`.

Evidencia: [V020-BACKEND-GATE.md](V020-BACKEND-GATE.md).

## Gate 2 — frontend ⏳

- `/auth`;
- `/auth/verify-email`;
- `/auth/totp/setup`;
- `/auth/recovery-codes`;
- `/auth/recover`;
- `/settings/security`;
- integración de sesión/cookies;
- UX de errores.

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

1. merge backend;
2. merge frontend;
3. merge docs;
4. gate desde `main`;
5. changelogs finales;
6. tag `v0.2.0`;
7. GitHub release.
