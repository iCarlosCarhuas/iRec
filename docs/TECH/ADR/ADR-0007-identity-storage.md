# ADR-0007 — Persistencia de Identity

**Estado:** Accepted  
**Objetivo:** v0.2.0

## Decisión

- PostgreSQL + Drizzle ORM para identidad persistente.
- Redis para estado efímero de autenticación y seguridad.

PostgreSQL contiene:

```text
users
email_tokens
totp_credentials
recovery_codes
trusted_devices
```

Redis contiene:

- auth flows;
- refresh tokens/families;
- reuse markers;
- access revocation markers;
- rate limits.

## Nota de evolución

La primera propuesta de este ADR describía sesiones opacas como mecanismo
principal. Antes del release v0.2.0 esa parte fue reemplazada por ADR-0009:
JWT RS256 corto + refresh opaco rotativo.

La decisión PostgreSQL + Redis permanece vigente.
