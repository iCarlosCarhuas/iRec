# Arquitectura técnica

## Stack actual

### Frontend
- Angular 22.
- TypeScript 6.
- Angular PWA / Service Worker.
- contratos compartidos `@irec/contracts`.
- CSS variables / design tokens.

### Backend
- NestJS.
- TypeScript.
- PostgreSQL 17.
- Drizzle ORM.
- Redis 8.
- Zod 4.
- `zod-openapi`.
- OpenAPI 3.1.
- Scalar.
- `jose` para JWT RS256.
- `otplib` para TOTP.
- `bcryptjs` para recovery codes.
- Nodemailer/Mailpit local; Resend producción.
- `CryptoService` AES-256-GCM para secretos reversibles server-side.

### Media roadmap
- `v0.4.0`: Cloudflare R2 BYO para fotos, thumbnails y assets.
- `v0.5.0`: AI Theme.
- `v0.6.0`: YouTube para videos/live y media gateway cuando corresponda.

R2-0 documenta el target; todavía no agrega SDK S3/R2 al runtime.

## Diagrama lógico

```mermaid
flowchart TB
WEB[Angular PWA] -->|HTTPS + HttpOnly cookies| API[NestJS API]
API --> DB[(irec-postgres / PostgreSQL)]
API --> REDIS[(irec-redis)]
API --> MAIL[irec-mailpit local / Resend prod]

WEB -. v0.4 presigned upload .-> R2[(Cloudflare R2 BYO)]
API -. v0.4 presign / metadata .-> R2
API -. v0.5 .-> AI[AI Provider]
API -. v0.6 .-> YT[YouTube APIs]
WEB -. v0.6 WebRTC .-> GW[Media Gateway]
GW -. RTMPS .-> YT
```

En v0.4.0 los bytes de las fotografías viajan normalmente del navegador a R2.
La API autoriza, prefirma, valida metadata y mantiene el dominio en PostgreSQL.

## Identity request path

```text
Angular
  ↓ HttpOnly cookies
NestJS
  ├─ JWT RS256 verification
  ├─ PostgreSQL identity
  └─ Redis refresh/revocation/rate-limit state
```

## Album Core

```text
Album
├── owner_id
├── visibility
├── members
└── text proposals
```

El owner también mantiene una membership `owner/active` como invariante de la
capa de servicio.

## R2 + Photos target

```text
User / owner
  │
  └── StorageConnection
         │
         ├── encrypted credentials
         └── Album (nullable association)
                │
                └── AlbumAsset
                       ├── R2 object metadata
                       └── moderation state
```

`StorageConnection` pertenece al usuario y puede reutilizarse. Los assets guardan
la referencia de almacenamiento necesaria para localizar objetos incluso si un
álbum cambia su configuración posteriormente.

## Monorepo

```text
iRec/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  └─ contracts/
├─ infra/
├─ docs/
├─ scripts/
└─ pnpm-workspace.yaml
```

La documentación no debe afirmar paquetes/directorios que no existan realmente
en el workspace actual.

## Naming

Los recursos técnicos creados por iRec usan:

```text
irec-<contexto>
```

Ejemplos:

```text
irec-api
irec-web
irec-postgres
irec-redis
irec-mailpit
irec-migrate
irec-network
```

## Límites de seguridad

- `apps/web` no recibe claves privadas, secreto TOTP ni credenciales R2.
- JWT/refresh viven en cookies HttpOnly, no en localStorage/sessionStorage.
- `packages/contracts` no contiene lógica de infraestructura.
- OpenAPI se genera desde schemas/rutas; no existe `openapi.yaml` manual.
- Scalar consume `/openapi.json`.
- R2 Secret Access Key nunca se envía de vuelta al frontend.
- R2 object keys son definidos por backend, no por input arbitrario del cliente.
- ninguna operación sobre fotos debe borrar buckets completos.
