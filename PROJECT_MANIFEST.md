# iRec Project Manifest

Stable release: `v0.3.0 — Album Core`
Working release: `v0.4.0 — R2 + Photos`
Integration branch: `integration/v0.4.0`
Current feature: `feat/v040-r2-verification`

## Core

```text
apps/api            NestJS API
apps/web            Angular PWA
packages/contracts  Zod shared contracts
```

## Released capabilities

### v0.1.0 — Foundation

Monorepo, local infrastructure, contracts, OpenAPI/Scalar and initial delivery baseline.

### v0.2.0 — Identity

Passwordless identity with verified email, TOTP, recovery codes, trusted devices,
JWT RS256, rotating refresh tokens, PostgreSQL, Redis and Mailpit/local email flow.

### v0.3.0 — Album Core

Albums, owner/member memberships, invitations to existing verified accounts,
text proposals with moderation, authenticated album UI and read-only public album
view.

## Current release — v0.4.0 R2 + Photos

R2-0 and R2-1 are integrated. R2-2 adds the real Cloudflare R2 verification
boundary and authenticated HTTP API for creating, listing and re-testing BYO
storage connections. Photo assets and presigned uploads remain later iterations.

Accepted direction:

- BYO Cloudflare R2 per creator/owner;
- storage connections are owned by users and may be reused by albums;
- R2 credentials stay server-side and reversible secrets use the existing
  `CryptoService` AES-256-GCM encryption;
- uploads use short-lived presigned URLs and normally travel browser -> R2;
- the API controls object keys;
- photo assets are separate from v0.3.0 text proposals;
- owner uploads are approved directly;
- active-member uploads enter moderation as pending;
- public albums expose approved photos only;
- no anonymous/guest uploads in v0.4.0.

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

## Documentation entry points

```text
docs/PROJECT-STATE.md
docs/BACKEND/R2.md
docs/BACKEND/PLAN.md
docs/TECH/ARCHITECTURE.md
docs/TECH/ADR/ADR-0003-r2.md
docs/TECH/ADR/ADR-0013-r2-photo-lifecycle.md
```

## Release discipline

`main` remains the latest stable released line. Work for `v0.4.0` is integrated
through `integration/v0.4.0` using isolated feature/worktree branches. Database
changes require migration review and the Data Safety gate before apply.

Package versions remain `0.3.0` during feature development. They are not bumped
until release preparation for `v0.4.0`.
