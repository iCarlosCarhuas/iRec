# iRec Project Manifest

Working candidate: `v0.2.0`
Integration branch: `integration/v0.2.0`

## Core

```text
apps/api       NestJS Identity API
apps/web       Angular PWA
packages/contracts  Zod contracts
```

## Full-stack Docker

```text
compose.yaml
.dockerignore
.env.docker.example
apps/api/Dockerfile
apps/web/Dockerfile
apps/web/nginx.conf
scripts/generate-docker-env.mjs
scripts/irec.ps1
scripts/verify-fullstack-docker.ps1
```

## Development infrastructure

```text
infra/docker-compose.dev.yml
```

## Identity backend

Includes PostgreSQL/Drizzle, Redis, Mailpit/Resend adapter, JWT RS256, rotating refresh tokens, TOTP, recovery codes, trusted devices, rate limiting and OpenAPI 3.1/Scalar.

## Identity frontend

Includes registration/login, email verification, TOTP setup, recovery codes, account recovery, trusted devices, TOTP rotation and HyperFrames onboarding.

## Documentation

Start at:

```text
docs/PROJECT-STATE.md
docs/GETTING-STARTED.md
docs/TECH/INTEGRATION-V020.md
docs/TECH/FULLSTACK-DOCKER.md
docs/TECH/RELEASE-V020-CHECKLIST.md
```
