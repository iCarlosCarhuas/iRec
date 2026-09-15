# Arquitectura técnica

## Stack actual

### Frontend
- Angular.
- TypeScript.
- Angular PWA / Service Worker.
- contratos compartidos `@irec/contracts`.
- CSS variables / design tokens.
- embeds/reproductor YouTube.

### Backend
- NestJS.
- TypeScript.
- PostgreSQL 17.
- Drizzle ORM.
- Redis.
- Zod 4.
- `zod-openapi`.
- OpenAPI 3.1.
- Scalar.
- `jose` para JWT RS256.
- `otplib` para TOTP.
- `bcryptjs` para recovery codes.
- Nodemailer/Mailpit local; Resend producción.

### Media futura
- Cloudflare R2: fotos, thumbnails y assets.
- YouTube: videos, live y grabaciones.
- MediaMTX/FFmpeg: WebRTC -> RTMPS para live desde navegador.

## Diagrama lógico actual

```mermaid
flowchart TB
WEB[Angular PWA] -->|HTTPS + HttpOnly cookies| API[NestJS API]
API --> DB[(irec-postgres / PostgreSQL)]
API --> REDIS[(irec-redis)]
API --> MAIL[irec-mailpit local / Resend prod]

API -. v0.4 .-> R2[(Cloudflare R2 BYO)]
API -. v0.5 .-> AI[AI Provider]
API -. v0.6 .-> YT[YouTube APIs]
WEB -. v0.6 WebRTC .-> GW[Media Gateway]
GW -. RTMPS .-> YT
```

## Identity request path

```text
Angular
  ↓ HttpOnly cookies
NestJS
  ├─ JWT RS256 verification
  ├─ PostgreSQL identity
  └─ Redis refresh/revocation/rate-limit state
```

## Monorepo

```text
iRec/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ contracts/
│  ├─ config/
│  └─ ui/
├─ infra/
├─ docs/
└─ pnpm-workspace.yaml
```

## Naming

Los recursos técnicos creados por iRec usan:

```text
irec-<contexto>
```

Ejemplos actuales:

```text
irec-infra
irec-postgres
irec-redis
irec-mailpit
irec-network
```

## Límites

- `apps/web` no recibe claves privadas, secreto TOTP ni credenciales R2.
- JWT/refresh viven en cookies HttpOnly, no en localStorage.
- `packages/contracts` no contiene lógica de infraestructura.
- OpenAPI se genera desde schemas/rutas; no existe `openapi.yaml` manual.
- Scalar consume `/openapi.json`.
