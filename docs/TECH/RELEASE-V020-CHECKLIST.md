# Release checklist — v0.2.0 Identity

## Desarrollo

- [x] Identity backend implementado.
- [x] Backend gate aprobado.
- [x] Identity frontend implementado.
- [x] Frontend gate aprobado.
- [x] TOTP onboarding.
- [x] HyperFrames QA.
- [x] Documentación de integración.
- [x] Full-stack Docker implementado en el candidato.

## Integración Git

- [ ] Crear `integration/v0.2.0` desde `main`.
- [ ] Merge `feat/backend`.
- [ ] Resolver conflictos y dejar limpio.
- [ ] Merge `feat/frontend`.
- [ ] Resolver contratos/lockfile como suma de ambos.
- [ ] Merge `docs/project`.
- [ ] Aplicar/commit del bloque Docker/DX.
- [ ] Push `integration/v0.2.0`.

## Docker gate

- [ ] `irec:setup` genera `.env.docker` una vez.
- [ ] Segundo `irec:setup` no cambia secretos.
- [ ] `docker compose up --build -d` termina sin error.
- [ ] `irec-migrate` termina exit 0.
- [ ] `irec-postgres` healthy.
- [ ] `irec-redis` healthy.
- [ ] `irec-api` healthy.
- [ ] `irec-web` healthy.
- [ ] Web responde 200.
- [ ] API live responde 200.
- [ ] API ready responde 200.
- [ ] Scalar abre.
- [ ] Mailpit abre.
- [ ] Reinicio conserva datos.

## Identity E2E

- [ ] Alta email.
- [ ] Email recibido en Mailpit.
- [ ] Verify email.
- [ ] TOTP enrollment.
- [ ] Confirmar TOTP.
- [ ] Guardar 10 recovery codes.
- [ ] Logout.
- [ ] Login real.
- [ ] Trusted device.
- [ ] Restauración de sesión.
- [ ] Recovery por email.
- [ ] Recovery code.
- [ ] Rotar TOTP.
- [ ] TOTP antiguo rechazado.

## Release

- [ ] Build/typecheck final desde integración.
- [ ] Changelogs finales.
- [ ] Merge `integration/v0.2.0` → `main`.
- [ ] Gate rápido desde `main`.
- [ ] Tag `v0.2.0`.
- [ ] Push tag.
- [ ] GitHub Release.
