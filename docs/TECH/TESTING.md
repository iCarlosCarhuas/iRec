# Testing y gates

## Gates ya aprobados

```text
Identity backend       PASSED
Identity frontend      PASSED
TOTP HyperFrames QA    PASSED
```

## Gate actual — full-stack Docker

En `integration/v0.2.0`:

```bash
pnpm verify:docker
```

Equivalente directo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-fullstack-docker.ps1
```

Comprueba:

```text
Docker daemon
.env.docker / compose
build API/Web
PostgreSQL healthy
Redis healthy
migrate exit 0
API live
API ready
OpenAPI
Scalar
Web
Mailpit
```

## Gate siguiente — Identity E2E

Después del gate Docker:

```text
registro por email
→ Mailpit
→ verify email
→ TOTP enroll
→ TOTP confirm
→ 10 recovery codes
→ logout
→ login email + TOTP
→ remember device
→ session restore
→ trusted devices
→ recovery email/code
→ TOTP rotation
→ TOTP anterior inválido
```

## Persistencia

Antes del release también debe comprobarse:

```text
docker compose down
→ docker compose up -d
→ usuario/datos locales siguen presentes
```

`docker compose down -v` no forma parte de una prueba de persistencia porque
elimina los volúmenes deliberadamente.

## Gate de release

`main` solo recibe `integration/v0.2.0` cuando Docker + E2E + builds/typechecks
están aprobados.
