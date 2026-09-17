# ADR-0008 — Correo transaccional

**Estado:** Accepted  
**Objetivo:** v0.2.0

## Decisión

- Mailpit SMTP en local.
- Resend en producción.
- adapter de correo desacoplado de auth.

## Regla

Registro y recuperación usan respuestas anti-enumeración:
la API no confirma si una cuenta existe.
